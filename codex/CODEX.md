# The Corpán Codex

_Concatenated book edition. Generated 2026-05-29.  All 36 numbered sections plus 5 appendices, in reading order._

---

# Front Matter

# The Corpán Codex

A study manual for the architecture of Corpán, the product built by Corpora,
and through that documentation a working education in the disciplines of
modern software engineering.

## Purpose

Two jobs in one document, braided:

1. A reference manual for this specific system. Every technology, every
   script, every convention, every place state lives. Open it, read two
   sections, know exactly where to work.
2. A general programming education. Each technology is explained on its
   own terms, using real Corpán code as the example. The reader learns
   React, Rust, Tauri, Kotlin, SQLite, Python, TypeScript, Tone.js,
   Whisper, Chatterbox, Babylon.js, monorepo discipline, version control,
   and the philosophy of building systems that do not break.

Both happen at once. There is no separate tutorial section.

## Audience

One reader: someone roughly a year into learning programming, working
primarily with AI coding agents, catching the tail end of the era when
senior engineers built systems by hand and the beginning of the era when
most code is co-written with models. Not a senior engineer. Not a total
beginner. The agent-era apprentice who wants both worlds fluent before
the field shifts again.

## How to read this

Front to back works. Jumping in by topic also works. Every section is
self-contained enough to be useful alone, and cross-references the rest.

If you have twenty minutes and a specific question, start with
appendix E (`appendices/e-where-to-look.md`), a reverse index from
"I want to understand X" to "read file Y."

If you are new to the system, read sections 01, 02, and 03 in order.
Then jump where curiosity pulls.

## Table of contents

### Part I, The System
- [01. Overview](01-overview.md)
- [02. The Monorepo](02-the-monorepo.md)
- [03. Version Control](03-version-control.md)

### Part II, The App
- [04. Tauri](04-tauri.md)
- [05. Rust](05-rust.md)
- [06. React](06-react.md)
- [07. TypeScript](07-typescript.md)
- [08. Vite](08-vite.md)
- [09. Styling](09-styling.md)

### Part III, The Pack System
- [10. Packs Overview](10-packs-overview.md)
- [11. Pack Anatomy](11-pack-anatomy.md)
- [12. Pack Host API](12-pack-host-api.md)
- [13. Pack Catalog](13-pack-catalog.md)
- [14. Pack Shared State](14-pack-shared-state.md)
- [15. Pack Transport](15-pack-transport.md)

### Part IV, Data and Content
- [16. SQLite](16-sqlite.md)
- [17. Content Formats](17-content-formats.md)
- [18. Audio Assets](18-audio-assets.md)

### Part V, The Pipeline
- [19. Python in the Stack](19-python-in-the-stack.md)
- [20. Chatterbox](20-chatterbox.md)
- [21. Whisper](21-whisper.md)
- [22. The Spark](22-the-spark.md)
- [23. 3D and Creative](23-3d-and-creative.md)

### Part VI, Storage and Delivery
- [24. S3](24-s3.md)
- [25. Captures and YouTube](25-captures-and-youtube.md)
- [26. State Locations](26-state-locations.md)

### Part VII, Platforms
- [27. iOS](27-ios.md)
- [28. Android](28-android.md)
- [29. Desktop](29-desktop.md)

### Part VIII, The Toolchain
- [30. Languages](30-languages.md)
- [31. The Shell](31-the-shell.md)
- [32. Package Management](32-package-management.md)

### Part IX, The Agent Era
- [33. Working with Agents](33-working-with-agents.md)
- [34. What Humans Still Do](34-what-humans-still-do.md)
- [35. The Near Future](35-the-near-future.md)

### Part X, Recent Evolutions
- [36. Changelog of the System](36-changelog-of-the-system.md)

### Appendices
- [A. Glossary](appendices/a-glossary.md)
- [B. Conventions](appendices/b-conventions.md)
- [C. Commands](appendices/c-commands.md)
- [D. Reading List](appendices/d-reading-list.md)
- [E. Where to Look](appendices/e-where-to-look.md)

## Status

Skeleton. Every file present, every section stubbed `TODO`. Filled in
across many sessions, one section at a time. Surface gaps as they
appear; do not smooth them over.

---

# 01. Overview

## What it is

Corpán is a cross-platform language learning application. The user
installs it on iOS, Android, macOS, Windows, or Linux; opens it; works
through phrases in a target language; hears them narrated; tracks
history; and downloads small packaged experiences ("packs") on demand.
The app is built with Tauri, a Rust binary that hosts a web view, with
the UI written in React and TypeScript. The central architectural
choice is the pack system. Each pack is a self-contained little app
with a strict, deliberately small contract to the host: it asks for
corpus entries, asks the host to speak them, asks for navigation. New
features ship as new packs rather than as edits to the core app, which
is what keeps the core small and what makes the system hygienic to
work in. The pack architecture is where most of the day-to-day design
attention goes; it is also where the manual's center of gravity sits
(sections 10 through 15). Corpora Inc is the company that ships
Corpán. **Encorpora**, "on Corpora," is Corpora's experimental lab,
and **this repository is encorpora**. The stable platform code lives
in a sibling repo at `github.com/corpora-inc/corpora`; the working
agreement is that things start here and graduate there when they
prove themselves.

## How it fits

The Codex documents what is in this repo. The reader of this manual is
touching encorpora: editing a pack, adjusting an audio pipeline,
debugging a Tauri command, regenerating the SQLite content database,
syncing a capture to S3. Things the reader will see referenced but that
do not live in this tree are the Corpora platform itself, the DGX
Spark filesystem reached over Tailscale (section 22), the S3 buckets
that hold audio, captures, and marketing assets (section 24), and the
user's device once an installed app has begun writing local SQLite and
downloading packs. Four places hold the project's running state: the
repo, the Spark, S3, the device. Section 26 maps how they synchronize
and where they do not.

## Files and entry points

At the root:

- `README.md` and `DEVELOPMENT.md`: the practitioner's quick start.
- `package.json`: the root build orchestrator. `npm run dev` composes
  the Next.js marketing site, the static Corpán pages, the two
  reference packs (hover-runner, juice-squeeze), and a watcher that
  copies pack outputs into the site.
- `.github/workflows/`: three GitHub Actions, `ci.yml`,
  `hover-runner-pages.yml`, `pr-agent.yml`. The Pages workflow is what
  publishes `encorpora.io` on push.
- `web/`: the public web surface. `web/io/` is the Next.js marketing
  site, `web/pages/` is the static Corpán pages, `web/scripts/` holds
  the dev server and pack watchers, `web/data/` is shared JSON.
- `corpan/`: the entirety of the app, its content pipeline, its
  packs, its plugins, its infra. **The Codex does not edit `corpan/`.**
  It documents it from the outside.
- `codex/`: this manual.

Inside `corpan/`:

- `corpan-app/`: the Tauri application. `src/` is the React frontend,
  `src-tauri/` is the Rust backend, `src-tauri/gen/` is generated
  platform code that is not edited by hand.
- `packs/`: pluggable mini-experiences. Each pack is its own npm
  package with `manifest.json`, a `dist/` build output, and a build
  script. As of writing on `main`: `earthgate-reader`, `hanzipan`,
  `hover-runner`, `juice-squeeze`, `pronunciation-coach` (with a
  pinned snapshot of `0.3.5` kept beside it), `quest-ear`, `sdk`,
  `shared`, `stargate-reader`, `world-radio`, `world-radio-legacy`.
  Packs in flight on other branches (Melopán, current Quest-Ear work)
  are not yet here.
- `dja/`: the Django content management system. The source of truth
  for the entry and translation corpus. `make_release_sqlite.py`
  builds the `release.sqlite3` that the app embeds.
- `docs/`: narrow architectural notes (`NAVIGATION_PLAN.md`,
  `PHRASE_PACK_AUTHORING.md`, `USER_DATA_DB_PLAN.md`).
- `infra/`: the captures pipeline, the S3 sync scripts
  (`sync-marketing-to-s3.sh`, `sync-voices-to-s3.sh`,
  `hydrate-audio.sh`, etc.), the IAP runbooks, the marketing assets,
  and a `terraform/` tree for the cloud side.
- `plugins/`: Tauri plugins. The legacy `tauri-plugin-game-packs`
  lives here; production uses app-managed installs.
- `scripts/` and `tools/`: release and content tooling.

Sitting beside `corpan/` at the root are content directories. These
are the source repositories for books and structured curricula:
`030-grade3`, `3read`, `books/`, `college-algebra-clep-practice-questions`,
`lengua-italiana-para-hispanohablantes`,
`math-acceleration-college-algebra-clep`,
`math-foundations-02-grade`, `panko`, `third-grade-homeschool`,
`total-history`, `world-history-illustrated`, `yijing`. Some compile
to PDF (`yijing/build.sh` produces a typeset book). Some feed packs.
Some are independent publications under the Corpora banner. They
share the repo because the same person edits across all of them on
the same day. Also at the root: `voices/` (voice clone data and the
scripts that exercise them), `arb/djarb` and `total-history/djistory`
(small Django sub-projects), `bonsai/` (a Jekyll site), and
`corpus-reader/` and `homeschool-offline/` (reading-oriented
sub-apps).

## How it works

The whole stack, end to end:

```
       Django (corpan/dja/)         <- corpus is authored here
              |
   make_release_sqlite.py
              |
       release.sqlite3
              |
              v
  corpan-app/src-tauri/  --embeds--+
   (Rust binary hosting a web view) |
              |                     |
       Tauri IPC (commands)         v
              |             get_random_entry_with_translations
   corpan-app/src/  (React)  get_random_entries_with_translations
              |             get_entry_by_id_with_translations
       loads packs at runtime
              |
       corpan/packs/* (each pack a tiny self-contained app)
              |
       host API: corpus, TTS, navigation
              |
       downloads pack zips into the
       device's app data directory

  Audio for narrators is rendered on the DGX Spark with
  Chatterbox, LUFS-normalized, synced to S3 by infra/ scripts,
  and pulled by packs at runtime.

  In parallel, web/io/ (Next.js) plus web/pages/ (static) build
  to web/io/out/, which GitHub Actions deploys to encorpora.io.
  Pack builds compose into that same output so a visitor can
  try a pack in a browser without installing the app.
```

The same content corpus is served four ways. Through the Django admin
for authoring. Through embedded SQLite in the installed app for
offline runtime. Through pack experiences that compose on top for
interactivity. Through the marketing pages and pack demos on
`encorpora.io` for the public face. Each surface holds a copy of the
corpus or a derivative of it; nothing recomputes from a single live
source. That choice is what makes the app work on a plane and the
website work without a backend.

## Common operations

1. **Run the public site locally.** From the repo root: `npm install`,
   then `npm run dev`. Visits `http://localhost:8000`. Composes
   Next.js, Pages, and two reference packs with watchers.
2. **Run the app locally.** `cd corpan/corpan-app && npm run tauri dev`.
   Hot reload on the React side. `cargo check` from `src-tauri/`
   verifies Rust without launching the app.
3. **Build the production website.** `npm run build` from the root.
   Output lands in `web/io/out/`.
4. **Build a binary of the app.** `cd corpan/corpan-app && npm run tauri build`
   for desktop. Mobile is `npm run tauri ios build` and
   `npm run tauri android build`.
5. **Bundle new content into the app.** Edit in Django
   (`cd corpan/dja && python manage.py runserver`), then
   `python make_release_sqlite.py`, then drop `release.sqlite3` into
   the app's content path.

## Why we built it this way

One repository for everything that is still moving. The Corpán app,
its packs, its content database, its books, its marketing site, and
its infra share git history because one person moves across all of
them on the same day. Splitting them would mean coordinating five PRs
to ship one feature. The stable layer lives elsewhere on purpose:
when code stops changing every week, it earns its own repository and
its own release cadence; until then it stays here, where a one-line
edit and `npm run dev` puts a working version in front of you. Within
`corpan/`, the pack system is the principal investment. The host stays
small, the contract stays small, and almost all the interesting
design moves into individual packs that can be reasoned about and
shipped one at a time. The Codex sits at the root, beside `corpan/`,
deliberately separate. Documenting the system from the outside lets
us describe it honestly without coupling to it.

## To go deeper

- `README.md` and `DEVELOPMENT.md` at the repo root: the official
  quick-start documents.
- `corpan/CLAUDE.md`: the more detailed map of the app subtree, kept
  current alongside the code it describes.
- `codex/README.md`: the table of contents for this manual.

---

# 02. The Monorepo

## What it is

Encorpora is a single git repository that holds many shippable things.
The Corpán app. Eleven packs at last count. Seven Tauri plugins. A
Django content management system. A Next.js marketing site. A second
static-Pages site that composes into the first. A dozen book and
curriculum directories at the root, some that build to PDF, some that
feed packs, some that publish on their own. A `voices/` tree of clone
data. Smaller Django sub-projects in `arb/`, `panko/`, and
`total-history/`. Two Tauri sub-apps in `corpus-reader/` and
`homeschool-offline/`. They all share one git history, one set of
remotes, one CI configuration, and one root `package.json` that knows
how to compose the public surface of all of them.

The organizing concept is the **shippable unit**. Anything that gets a
version number, gets bundled, or gets deployed is a shippable unit and
keeps its own `CHANGELOG.md` next to its manifest. The rules are in
`corpan/CHANGELOGS.md`: Keep a Changelog format, strict SemVer in the
manifest, an `[Unreleased]` block that grows entry-by-entry as PRs land
and promotes to a dated section the moment the version field changes.

## How it fits

This repo is encorpora; the stable Corpora platform lives in a sibling
repo at `github.com/corpora-inc/corpora`. The monorepo discipline does
not extend across that boundary. Inside this repo, however, almost
everything that is still moving lives together, deliberately. The
practical effect is that one PR can change the Corpán app, bump a
plugin, edit a pack, regenerate the content database, and update the
public landing page for that pack, in one reviewable diff.

The cross-cutting workflow that motivates this is the pack pipeline:
authoring content in `corpan/dja/`, generating audio with the
narration pipeline (which lives partly in the repo and partly on the
Spark), building a pack in `corpan/packs/<name>/`, packaging it as a
zip and a manifest, copying both into `web/io/out/corpan/packs/`,
publishing through GitHub Pages, and installing back into the app
either by URL (manifest install) or by zip download. Every one of
those steps touches a different subtree of this repo. Splitting them
would mean coordinating that many PRs across that many repos.

## Files and entry points

### Top of the tree

- `README.md`, `DEVELOPMENT.md`: the public quick-start and the
  developer overview.
- `package.json`: the root build orchestrator. `npm run dev` composes
  Next.js + Pages + reference packs + watchers; `npm run build`
  produces the production `web/io/out/`; `npm run package:packs` zips
  pack manifests with their `dist/` for offline install.
- `.github/workflows/`: three workflows, `ci.yml`,
  `hover-runner-pages.yml` (the Pages publisher), `pr-agent.yml`.
- `GITHUB_PAGES_SETUP.md`: the canonical guide to composition. Read
  this before touching the build orchestrator.
- `GAME_INSTALL_SUMMARY.md`: the two-method pack install model
  (manifest URL vs. zip download).
- `GIT_LFS.md`: SQLite files (`*.sqlite3`) are tracked with Git LFS so
  the database bundles can exceed GitHub's 100 MB raw limit.
- `PIPELINE_STATE.md`: a dated snapshot of the narration pipeline
  (the teammate Skylar maintains this).
- `RELEASE_NOTES_*.md`: per-release notes for Corpán app versions
  (`0.12.7`, `0.12.7_ANDROID`, `0.13.1`).
- `.corpora.yaml`, `.corpora/`: metadata for the Corpora platform.
- `.gitattributes`, `.gitignore`: LFS rules, ignore rules.

### `corpan/` (the flagship subtree)

- `corpan-app/`: the Tauri application. `src/` React + TypeScript,
  `src-tauri/` Rust, `src-tauri/gen/` generated and not hand-edited,
  `CHANGELOG.md` for the app itself.
- `packs/`: each pack is a self-contained npm package with its own
  `manifest.json`, build script, `dist/`, and `CHANGELOG.md`. The
  `sdk/` and `shared/` subtrees hold what packs import to talk to the
  host.
- `dja/`: Django CMS. Authors edit `Entry`, `Translation`,
  `Narrator`, `Pack` rows; `make_release_sqlite.py` produces
  `release.sqlite3` for the app to embed.
- `plugins/`: seven Tauri plugins, each with its own `Cargo.toml` and
  `CHANGELOG.md`: `tauri-plugin-audio-keepalive`,
  `tauri-plugin-game-packs` (legacy), `tauri-plugin-iap`,
  `tauri-plugin-radio-stream`, `tauri-plugin-stt`,
  `tauri-plugin-subscriptions`, `tauri-plugin-tts`.
- `infra/`: the captures pipeline (`captures/`), the S3 sync scripts
  (`sync-marketing-to-s3.sh`, `sync-voices-to-s3.sh`,
  `hydrate-audio.sh`, `hydrate-marketing.sh`, `hydrate-voices.sh`),
  the IAP runbooks (`IAP_SETUP_RUNBOOK.md`), the publishing runbook
  (`PUBLISHING.md`), catalog tooling, and a `terraform/` tree for the
  cloud side.
- `docs/`: architectural notes (`NAVIGATION_PLAN.md`,
  `PHRASE_PACK_AUTHORING.md`, `USER_DATA_DB_PLAN.md`).
- `scripts/`, `tools/`: release and content tooling
  (`pack-i18n/`, `phrase-packs/`, `rebuild-hanzi-pack.sh`).
- `CLAUDE.md`: the deep-dive guide for the app subtree, kept current
  alongside the code.
- `CHANGELOGS.md`: the shippable-units doctrine for the whole repo.

### `web/`

- `web/io/`: the Next.js marketing site. Source of truth for the
  domain root. Builds to `web/io/out/`. Has its own `AGENTS.md` and
  `README.md`.
- `web/pages/`: static Corpán pages. `build.js` reads HTML templates
  from `templates/` and JSON data from `web/data/` (and from
  `web/pages/data/`), and writes into `web/io/out/corpan/`. `watch.js`
  drives dev rebuilds.
- `web/scripts/`: the orchestration glue. `dev-server.js` proxies
  everything together at `http://localhost:8000`, `watch-packs.js`
  rebuilds packs into the live tree, `serve-local.sh` does a one-shot
  build-and-serve, `setup.sh` is the new-machine bootstrap,
  `generate-book-catalog.js` produces the books index, `gads/` is the
  Google Ads helper.
- `web/data/`: shared JSON (the book catalog and so on).

### The top-level content tree

The remaining root directories are content. They share the repo
because the same hands edit them. They fall into a small number of
shapes:

- **Curricula authored as numbered markdown chapters**: `030-grade3`,
  `college-algebra-clep-practice-questions`,
  `lengua-italiana-para-hispanohablantes`,
  `math-acceleration-college-algebra-clep`,
  `math-foundations-02-grade`. Each is a tree of files like
  `01-02-03-comparing-ordering-numbers.md`. These are the source for
  individual books in the Corpora educational line.
- **Books with a build toolchain**: `third-grade-homeschool`,
  `yijing`, and the directories nested under `books/`
  (`books/food`, `books/history`, `books/lifestyle`,
  `books/literature`, `books/music`, `books/religion`,
  `books/science`, `books/sports`). Many include a `build.sh`, LaTeX
  headings, an `epub.css`, and a `defaults.yaml` that compose into a
  printable artifact. The same book trees also host the narration
  packs that feed Corpán's audio offerings (see
  `corpan/CHANGELOGS.md` row for "Narration series").
- **Django sub-projects**: `arb/djarb`, `panko/djpanko` (with a
  sibling `pako/` and `requirements.txt`), and
  `total-history/djistory`. Smaller content backends, each shaped
  like `dja/` but scoped to one topic.
- **Tauri sub-apps**: `corpus-reader/` and `homeschool-offline/`.
  Each is its own application (React + TypeScript + `src-tauri/`),
  separate from Corpán, sharing the monorepo so they can pull from
  the same content authoring without splitting the history.
- **Web extensions and Jekyll sites**: `3read/` (a Chrome extension
  for reading practice, CoffeeScript and JS), `bonsai/` (a Jekyll
  site).
- **Voice data**: `voices/data/` and `voices/scripts/` hold reference
  audio for narrators and the scripts that exercise them. The clone
  WAVs and rendered samples themselves live on disk outside the repo
  at `~/Desktop/corpan-voice-clones/`; only the per-voice metadata
  and exercise scripts are tracked here.
- **World content**: `world-history-illustrated/history-of-japan`,
  `total-history/djistory`. Side-collections that publish under
  their own names.

## How it works

Two patterns make the monorepo work.

### The shippable-units pattern

Every versioned thing in the repo has a `CHANGELOG.md` colocated with
its manifest. `corpan/CHANGELOGS.md` enumerates the map:

| Unit             | Path                                       | Version source                                  |
|------------------|--------------------------------------------|-------------------------------------------------|
| Core app         | `corpan/corpan-app/CHANGELOG.md`           | `package.json`, `Cargo.toml`, `tauri.conf.json` |
| Packs            | `corpan/packs/<pack>/CHANGELOG.md`         | `manifest.json` `version`                       |
| Tauri plugins    | `corpan/plugins/<plugin>/CHANGELOG.md`     | `Cargo.toml` `version`                          |
| Narration series | `books/<category>/<series>/CHANGELOG.md`   | per-book `manifest.json` `version`              |

The rule is simple: when you make a user-visible change to a unit,
append an entry to its `[Unreleased]` section in the same PR.
No batching. When the version field in the manifest changes, you
promote `[Unreleased]` to a dated heading and open a fresh
`[Unreleased]` above it.

If a single change crosses units (a Corpán feature that requires a
plugin bump), the entry appears in **each** affected unit's changelog.
The cost of writing it twice is much smaller than the cost of someone
landing in one of those directories later and not seeing it.

### The composable Pages architecture

`encorpora.io` is built from three sources composed into one output
tree. `GITHUB_PAGES_SETUP.md` is canonical; the short version is:

```
web/io/   (Next.js)         --build-->  web/io/out/
web/pages (static templates) --build--> web/io/out/corpan/
corpan/packs/<name>/dist/   --copy-->   web/io/out/corpan/packs/<name>/
corpan/packs/<name>.zip     --copy-->   web/io/out/corpan/packs/<name>.zip

   final tree -> deployed to encorpora.io by hover-runner-pages.yml
```

The root `package.json` orchestrates this. `npm run build` runs
`build:io`, `build:pages`, and `build:packs` in sequence;
`build:packs` itself runs each pack's own build, then `package:packs`
zips each pack (`manifest.json` plus `dist/`), then `copy:packs` lays
everything into `web/io/out/`. The GitHub Action does the same steps
in CI and pushes the result to Pages.

Two pack-install modes fall out of this naturally:

- **Manifest install**: the app fetches
  `https://encorpora.io/corpan/packs/<pack>/manifest.json`, loads
  `dist/app.js` and friends over HTTPS, always gets the latest. Good
  for development and for in-app dev mode (unlock by tapping the
  Corpán label seven times).
- **Zip install**: the app downloads
  `https://encorpora.io/corpan/packs/<pack>.zip`, extracts into the
  device's app data dir, and serves the files locally through the
  custom `corpan-pack://` URL scheme. Good for production and for
  offline use.

The app detects which is which from the URL extension.

## Common operations

1. **Add a new pack.** Create `corpan/packs/<name>/` with a
   `manifest.json` and a build script that emits `dist/`. Add the
   pack's id and metadata to `web/pages/data/packs.json`. Add build
   steps to `.github/workflows/hover-runner-pages.yml` (install,
   build, copy `dist/`, copy zip). Add a `package:<name>` script and
   a `copy:<name>` script to the root `package.json` so the root
   build covers it. Start a `CHANGELOG.md` with `[Unreleased]`.
2. **Add a narration series.** Author the source in the relevant
   `books/<category>/<series>/` directory. Each per-book pack lives
   at `<series>/packs/<voice>-<engine>-v<n>/` with its own
   `manifest.json` and `CHANGELOG.md`. The narration pipeline (Spark
   side) renders audio and `infra/sync-voices-to-s3.sh` uploads it.
3. **Bump a unit's version.** Edit the version field in the manifest
   that owns it (a pack's `manifest.json`, the app's `package.json` +
   `Cargo.toml` + `tauri.conf.json`, a plugin's `Cargo.toml`).
   Promote the `[Unreleased]` block in the same `CHANGELOG.md` to a
   dated entry. Open the next `[Unreleased]` block above it.
4. **Run the whole public site locally with watchers.** From the
   root: `npm install`, `npm run dev`. Visit
   `http://localhost:8000/`. Hot reload works across the Next.js
   site, the static Corpán pages, and the two reference packs.
5. **Build only one pack's site preview.** From the pack's directory:
   `npm run build`. Then `./web/scripts/serve-local.sh` to serve the
   composed tree, or open the pack landing page directly in the
   composed output.
6. **Bootstrap a fresh checkout.** `git lfs install`, then
   `git lfs pull` to fetch SQLite bundles. Then
   `./web/scripts/setup.sh` to install root and per-project npm
   dependencies.

## Why we built it this way

One person works across the whole tree on the same day. Splitting the
repo by subsystem would optimize for a coordinated team that does not
exist; instead the cost falls entirely on the person who has to open
five PRs to ship one feature. The monorepo also lets the cross-cutting
flows (the pack pipeline, the audio pipeline, the publish pipeline)
share tooling without packaging it as separate libraries: a shell
script under `web/scripts/` can read from `corpan/packs/`, write into
`web/io/out/`, and copy into `corpan/dja/` fixtures without crossing
any repo boundary.

The shippable-units pattern is the discipline that keeps a monorepo
from rotting. Without per-unit changelogs and per-unit version
sources, "release notes" devolve into a single timeline of unrelated
work. With them, every directory that ships independently has its
own coherent history. The doctrine that the entry lands in the same
PR as the change is what makes that history honest; batching
changelogs is how they become fiction.

The Codex sits at the root, beside `corpan/`, on the same monorepo
terms. It documents the system from the outside, but it travels with
it.

## To go deeper

- `corpan/CHANGELOGS.md`: the shippable-units doctrine in full.
- `GITHUB_PAGES_SETUP.md`: composition of the public site, with a
  step-by-step for adding a new pack or a new app.
- `DEVELOPMENT.md`: per-project commands and the troubleshooting
  layer.
- Joel Spolsky, "Things You Should Never Do, Part I" and Fabien
  Sanglard's writeups of single-tree codebases (Doom, Quake) for the
  general case for keeping everything together.

---

# 03. Version Control

## What it is

Git is the spine of this project. Everything that matters is either
in git or is a derivative of something in git. The marketing site can
be rebuilt from a commit. The app binary can be rebuilt from a commit.
The book PDFs can be rebuilt from a commit. The SQLite database that
ships inside the app comes from authored rows that are themselves
serializable to commits. When state lives outside git, in S3, on the
Spark, on a device, we treat it as a cache of something git could
produce again, or we treat it as ephemeral.

The reason the spine matters this much is that a project this small
with this much surface area cannot afford an authoritative copy of
anything to live outside an inspectable, diffable, durable record.
Git provides that record. Every commit is a content-addressed
snapshot of every tracked file. `git log` is the history of decisions
and `git diff` is the unit of communication between yesterday-Jeff
and today-Jeff. The plain-text bias throughout the rest of the
manual (`.md` over `.pdf`, `.json` over a binary blob, shell scripts
over GUI tooling) is in large part so that Git can do its job: a
two-character whitespace fix in a Markdown file shows up as a
two-character diff that reviews itself.

## How it fits

Git connects everything in the repo to everywhere it ships. A push to
`main` triggers the GitHub Actions workflow that builds and deploys
the public site. A tag on the Corpán app triggers the build pipeline
for the App Store and Play Store binaries. A new pack version flows
through the same `main` and out through the same Pages deploy. The
upstream remote (`corpora-inc/encorpora`) is the canonical record of
what is shipped; an individual Jeff branch on the fork
(`Umanistan/encorpora`) is the working copy. The PR is the bridge
between them, and Skylar (the teammate who maintains the narration
pipeline) is the reviewer who decides when a bridge gets crossed.

Outside this directory, two companions live in adjacent worktrees on
the same disk: `~/Code/encorpora` on branch `melopan`, and
`~/Code/encorpora-ear` on branch `quest-all-hearing-ear`. This
directory, `~/Code/corpora-codex`, is itself a worktree, on branch
`codex`, where the manual is written. Three branches checked out at
the same time. Three editors open. One git repository. Worktrees are
the mechanism, and they are central enough that they get their own
subsection below.

## Files and entry points

- `.git/`: the repository itself. Do not edit by hand. Inspect with
  porcelain (`git log`, `git diff`, `git status`) and plumbing
  (`git cat-file`, `git rev-parse`, `git ls-tree`) when curiosity
  demands.
- `.gitattributes`: LFS rules and any attributes that change how Git
  handles specific paths. Currently four lines, all LFS filters for
  `*.sqlite3`, `*.png`, `*.epub`, `*.pdf`.
- `.gitignore`: paths git should ignore. Holds the durable list:
  `node_modules/`, `.venv/`, `target/`, build outputs (`web/io/out/`,
  `.next/`), audio assets that get hydrated from S3
  (`**/pack/audio/`, `**/packs/*/audio/`), voice reference WAVs
  (`voices/data/*.wav`), and `Cargo.lock` (kept ignored deliberately;
  the comment explains a `rusqlite` versus `sqlx` member mismatch
  blocking commit).
- `.github/workflows/ci.yml`: the path-filtered build gate. Runs
  `tsc` and `build` for `corpan-app`, `build` for `web/io`,
  `terraform fmt -check` and `terraform validate` for
  `corpan/infra/terraform`. Skipped entirely for changes that touch
  only books, voices, the Codex, etc.
- `.github/workflows/hover-runner-pages.yml`: the deploy workflow.
  Builds the composed site on every push to `main` whose changes
  touch `web/io/`, `web/pages/`, `corpan/packs/`, or the workflow
  itself, then publishes to GitHub Pages.
- `.github/workflows/pr-agent.yml`: Codium AI's PR-Agent on every
  opened or reopened pull request. Posts summaries and review
  comments automatically.
- `GIT_LFS.md`: the LFS bootstrap doc. New clones need
  `git lfs install` and `git lfs pull` to materialize the SQLite
  bundles.

## How it works

### Git from first principles

Git stores files as **blobs**, identified by the SHA-1 hash of their
content. A **tree** is a directory: it lists names and the hashes of
the blobs and trees inside it. A **commit** is a tree plus metadata:
an author, a timestamp, a message, and pointers to its parent
commits. The repository is just a directed acyclic graph of commits,
with named **refs** (branches, tags, remotes) pointing into it.

That is the whole data model. Nothing else is fundamental. Every
porcelain command (`add`, `commit`, `branch`, `merge`, `rebase`,
`pull`, `push`) is a high-level operation on that graph. Once the
data model clicks, the operations stop feeling like magic.

A few consequences worth holding:

- Commits are **immutable**. `git commit --amend` does not edit a
  commit; it makes a new commit with the same parent and moves your
  branch pointer to it. The old commit is still in the database
  until garbage collection runs.
- Branches are **just refs**. A branch is a name pointing at a
  commit hash. Switching branches moves the working tree to match a
  different commit. Deleting a branch deletes only the ref; the
  commits behind it may still be reachable from another ref or from
  the reflog.
- History rewrites (rebase, amend, reset) are **local** until you
  push. After you push, anyone who has fetched is affected; this is
  why `git push --force` is the operation that deserves the most
  thought before it happens.
- Diffs are **computed**, not stored. Git stores whole snapshots,
  not deltas. `git diff` between two commits asks the database to
  compare two trees and produce a textual difference at view time.
  Plain-text inputs make that diff useful; binary inputs make it
  meaningless.

That last point is the reason most of this repo is plain text.

### The encorpora remote arrangement

There are two remotes:

```
origin    https://github.com/Umanistan/encorpora.git   (fetch, push)
upstream  https://github.com/corpora-inc/encorpora.git (fetch only)
```

`origin` is Jeff's personal fork. Push commits there to share them or
to open a pull request. `upstream` is the team repository. The push
URL is intentionally disabled (`DISABLED`) so a forgetful
`git push upstream` does not write directly to the canonical history;
the only way for a change to reach `upstream/main` is through a pull
request from the fork, reviewed by Skylar.

A fresh clone of the fork does not have `upstream` automatically. The
one-time setup is:

```bash
git clone https://github.com/Umanistan/encorpora.git
cd encorpora
git remote add upstream https://github.com/corpora-inc/encorpora.git
git remote set-url --push upstream DISABLED
git lfs install
git lfs pull
```

`upstream/main` is what you base feature branches on. The day-to-day
sync is:

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main
```

Fast-forward only on `main`. If a merge is required to bring
`upstream/main` into your `main`, something has gone wrong upstream
(or your `main` was diverged) and the right move is to investigate,
not to manufacture a merge commit.

### Worktrees as the parallelism primitive

A worktree is a second working directory attached to the same git
repository. Different branches can be checked out in each. The
underlying `.git/` is shared; the file trees are independent.

This repo uses three worktrees concurrently:

```
$ git worktree list
/Users/jeffryeverett/Code/encorpora        [melopan]
/Users/jeffryeverett/Code/corpora-codex    [codex]
/Users/jeffryeverett/Code/encorpora-ear    [quest-all-hearing-ear]
```

The motivation is direct. Jeff has the Melopán pack open in one
editor while shipping Quest-Ear work in another while writing this
manual in a third. With one working directory and one branch
checkout, the only options for switching between three contexts are
to commit, stash, or lose work; with worktrees, each context lives in
its own directory and stays put. Agents working in parallel get the
same benefit: each worktree is an isolated sandbox that cannot stomp
the others.

The mechanics:

```bash
# Create a new worktree from an existing branch.
git worktree add ../encorpora-foo feature/foo

# Create a new worktree on a new branch.
git worktree add -b experiment ../encorpora-experiment

# List them.
git worktree list

# Remove one when done (it is safe; the branch survives).
git worktree remove ../encorpora-experiment
```

Worktrees share LFS storage and the object database, so they are
cheap. They share `.gitignore` too, so per-worktree noise belongs in
`.git/info/exclude` for the worktree if you must.

The discipline the project enforces: **stay in your lane.** When
multiple agents (or one agent and a human) are working in parallel
worktrees, edit only the files relevant to your worktree's branch.
The shared object database does not arbitrate intent.

### Git LFS

GitHub's blob limit is 100 MB. The Corpán release database
(`corpan-app/release.sqlite3`) and several content database snapshots
routinely exceed that. The `.gitattributes` line
`*.sqlite3 filter=lfs diff=lfs merge=lfs -text` tells git to store
those files in LFS instead of inline. The same treatment is applied
to `*.png`, `*.epub`, and `*.pdf` because there are many of them and
they would not diff usefully anyway.

What this means for the day-to-day:

- `git clone` downloads the LFS pointer files only. `git lfs pull`
  hydrates them into real content. If a teammate clones and sees
  18-byte SQLite files, they forgot the `lfs pull`.
- Adding a new file with one of the tracked extensions is automatic:
  `git add` sees the attribute and routes the content to LFS.
- LFS uses bandwidth quota on the hosted account. Be deliberate
  about checking in large binaries that change frequently. For audio
  that S3 is the canonical store of, the `.gitignore` already
  excludes the raw assets; the build pipeline hydrates them from S3
  via `corpan/infra/hydrate-audio.sh`.

### CI gates only what compiles

`ci.yml` is intentionally narrow. It runs on changes to
`corpan/corpan-app/**`, `corpan/packs/**`, `corpan/infra/terraform/**`,
and `web/io/**`. A book edit, a Codex update, a voice metadata change
does not spin up a runner. Three jobs do the work:

- `corpan-app · tsc + build` checks TypeScript and that the React
  build succeeds. It does **not** run `cargo build` for the Rust
  side; that is too slow for a per-PR gate and is exercised on
  release builds.
- `web-io · build` checks that the Next.js marketing site builds.
- `terraform · fmt + validate` checks `corpan/infra/terraform`.

`pr-agent.yml` is unrelated to compilation. It is Codium's PR-Agent,
which uses an LLM to post summaries and review comments to every
new PR. It is not a gate; nothing blocks on it.

### Commit and PR style

`git log -20 upstream/main` shows the recent shape:

```
ecaa596c parlometron, start >0.13.1 onboarding and phrase pack architecture (#255)
d076f112 Corpan 0.13.X - PARLOMETRON GAME (#253)
6cb89abf 0.13.0 corpan + PARLOMETRON (#252)
c7689860 DGX catalog (#249)
1c6423db More earthgate (#251)
c66d5d77 Almost 0.12.6 - Pronunciation coach on Android CPU, whisper.cpp (#250)
17943fd6 Hanzipan, earthgate touches, controls chapter/title display earth/star (#248)
...
```

The conventions to read off this:

- Squash merges. One commit per PR on `main`, with the PR number in
  parentheses.
- Titles describe the user-visible change. App version bumps lead
  with the version (`Corpan 0.12.6`). Pack and plugin work names the
  unit (`Pronunciation coach 0.3.5`, `World Radio 0.6.0`).
- Capitals and casing are loose; clarity is not.
- One linear history. Merge commits are rare and named when they
  happen (`aa874fad merge forgotten changes`).

For changelog discipline (per `corpan/CHANGELOGS.md`, see section 02),
the rule is that every PR that changes a shippable unit appends to
that unit's `[Unreleased]` section in the same diff. The PR review
checks for it.

## Common operations

1. **Start a feature branch.** From a synced `main`:
   `git checkout -b feature/my-thing` (or `ian/<topic>`,
   `book/<series>`, etc., matching the patterns visible in
   `git branch -a`).
2. **Open a parallel worktree.**
   `git worktree add ../encorpora-foo feature/foo`. Edit there;
   leave the current worktree alone.
3. **Push and PR.** `git push -u origin feature/my-thing`, then
   `gh pr create --base main --head Umanistan:feature/my-thing` (the
   PR targets `corpora-inc/encorpora:main` because the fork is
   configured against it).
4. **Sync your main from upstream.**
   `git fetch upstream && git checkout main && git merge --ff-only upstream/main && git push origin main`.
5. **Hydrate LFS after a fresh clone.**
   `git lfs install && git lfs pull`.
6. **Inspect what a commit changed.**
   `git show <hash> --stat` for the file list, `git show <hash>` for
   the patch, `git log --follow <path>` to trace a file's history
   across renames.
7. **Recover work you thought was lost.** `git reflog` shows every
   ref move on this machine for the last 90 days. Almost nothing in
   Git is gone immediately; the reflog is how you find it.

## Why we built it this way

The fork-and-upstream split with `upstream` push disabled is small
mechanical insurance against a class of accident: pushing a half-done
branch directly to the team repo because the muscle memory is
`git push`. Disabling the push URL forces the PR path. The cost is
two lines of remote configuration; the payoff is that there is no
plausible way to bypass review even when distracted.

Worktrees over branch switching is the agent-era discipline. A model
working in one worktree cannot accidentally touch another's files,
and the human can compare diffs across worktrees without juggling
stashes. The earlier era's pattern (one checkout, `git stash`
liberally, hope nothing is forgotten) breaks down the moment two
contexts are actively in flight.

LFS for SQLite is a concession to GitHub's blob limit, not a
preference. The hope is that one day the content database becomes
small enough or pluggable enough that LFS is unnecessary. Until then,
LFS keeps the source-of-truth bundle in the same history as the code
that consumes it.

CI is path-filtered so that the cost of running it scales with the
risk. Changes to books or to the Codex do not need a Node runner.
The build that does run (`tsc` plus React build) is the cheapest
useful check; everything heavier (Rust builds, mobile packagers)
lives in release pipelines.

The plain-text bias is the largest single design choice in the
repository, and the one most easily underestimated. A four-line
patch to a Markdown file in a book directory and a four-line patch
to a React component compose into the same kind of PR. They are
reviewed with the same tooling and they are recoverable with the
same commands. Anything that breaks that symmetry (a binary asset
that has to be regenerated, a stateful database that has to be
re-seeded) is an exception we accept reluctantly.

## To go deeper

- Scott Chacon and Ben Straub, *Pro Git*: free at `git-scm.com/book`.
  Chapters 2, 3, and 10 cover the data model and remote workflows
  in the depth this section gestures at.
- `git help worktree` and `git help reflog` for the two most
  underused subcommands in daily work.
- `GIT_LFS.md` at the repo root for the LFS bootstrap and recovery
  recipes (including history rewrites, which are sometimes the
  right answer for large files accidentally committed without the
  LFS filter).

---

# 04. Tauri

## What it is

Tauri is the framework Corpán is built on. A Tauri application is a
single native binary, written in Rust, that creates operating-system
windows and fills each one with a webview. The webview is the same
native browser engine the OS already ships: WKWebView on macOS and
iOS, WebView2 on Windows, WebKitGTK on Linux, and Android's system
WebView on Android. The user interface is HTML, CSS, and JavaScript
running inside that webview; the privileged work, file I/O, SQLite,
HTTP, native APIs, lives in the Rust binary. The two halves
communicate over a JSON-over-IPC channel.

The version pinned in `corpan/corpan-app/src-tauri/Cargo.toml` is
Tauri 2. The version 2 line is the one that added first-class iOS and
Android targets to what was previously a desktop-only framework, and
it is why the same `tauri::Builder` invocation in
`corpan-app/src-tauri/src/lib.rs` produces a `corpan` binary for
macOS, Windows, Linux, iOS, and Android.

## How it fits

Tauri is the host. Everything else in `corpan/corpan-app/` is either
hosted by it (the React UI in `src/`) or is plugged into it (the
seven Tauri plugins under `corpan/plugins/`, each contributing native
behavior like TTS, STT, IAP, audio keepalive, radio streaming, and
subscriptions). The Tauri runtime is also what loads packs at runtime:
the same Rust binary that exposes corpus commands also serves
installed pack files through a custom `corpan-pack://` URL scheme so
the webview can `<script src="corpan-pack://...">` packed content
that was downloaded into the app data directory.

Tauri also fixes the platform boundary on which the rest of the
Codex's architecture rests. The IPC contract (a small set of
`#[command]` functions) is the seam between the React world (sections
06, 07) and the Rust world (section 05). Most other architectural
decisions in `corpan-app/` are downstream of Tauri's choices.

## Files and entry points

- `corpan-app/src-tauri/Cargo.toml`: the Rust manifest. Pins
  `tauri = "2"`, plugin paths (relative `../../plugins/...`), and the
  release profile. The release profile is tuned for size and mobile
  (`opt-level = "z"`, `lto = true`, `codegen-units = 1`,
  `panic = "abort"`). It also patches `ndk-context` to a vendored
  fork (see "Android exit prevention" below).
- `corpan-app/src-tauri/tauri.conf.json`: the Tauri configuration.
  Names the product (`corpan`), the version (mirrors `Cargo.toml`),
  the identifier (`com.corpora.corpan`), the dev URL
  (`http://127.0.0.1:1421`, fed by Vite), the production frontend
  bundle (`../dist`), the window defaults, and the iOS/macOS signing
  identities.
- `corpan-app/src-tauri/src/main.rs`: six lines. Calls
  `corpan_lib::run()`. The library/binary split is documented in
  `Cargo.toml` (the `_lib` suffix on the library name dodges a
  Windows Cargo issue, per the comment).
- `corpan-app/src-tauri/src/lib.rs`: the heart, 1,338 lines. Declares
  the modules (`content_packs`, `db`, `pack_db`, `phrase_packs`),
  every `#[command]` exposed to the frontend, the `tauri::Builder`
  that wires them together, and the runtime event handler.
- `corpan-app/src-tauri/src/{content_packs,db,pack_db,phrase_packs}.rs`:
  the supporting modules. `db.rs` owns the bundled SQLite handle,
  `content_packs.rs` handles pack install/download, `pack_db.rs`
  opens per-pack SQLite databases, `phrase_packs.rs` is the
  multi-source phrase corpus.
- `corpan-app/src-tauri/build.rs`: two lines. Runs `tauri_build::build()`
  at compile time to generate the IPC scaffolding from the config.
- `corpan-app/src-tauri/capabilities/default.json`: the **capability**
  declaration. Tauri 2's capability system is an explicit allowlist
  of which commands and plugin permissions the main window may use.
  This file grants `core:default`, `opener:default`, `tts:*`,
  `audio-keepalive:default`, `radio-stream:default`, `iap:default`,
  `subscriptions:allow-show-manage-subscriptions`, `stt:default`,
  and `os:default`.
- `corpan-app/src-tauri/gen/android/`: generated Android project
  scaffolding. **Do not edit by hand.** Tauri regenerates it on
  `npm run tauri android dev` and on build; manual edits are
  overwritten.
- `corpan-app/src-tauri/ios/`: iOS project template; mirrors the
  Android setup but with `project.yml` and the iOS bundle config.
- `corpan-app/src-tauri/vendor/ndk-context/`: a vendored fork of the
  `ndk-context` crate with one upstream assertion removed (see the
  Android exit prevention discussion below for why).

## How it works

### The Rust/webview split

When `tauri dev` runs, two processes start. Vite serves the React
frontend at `http://127.0.0.1:1421` (the URL named in
`tauri.conf.json`'s `devUrl`). Tauri builds and runs the Rust binary,
which opens a window and points its webview at that URL. In a
production build, the same Rust binary embeds the static React build
output (`../dist`) as resources and the webview is pointed at an
internal URL that serves them.

The webview does not have direct access to anything the OS would
normally guard. It cannot read the filesystem, open arbitrary URLs,
hit local SQLite, or speak through the OS TTS API. To do any of those
things, it has to ask the Rust side.

### The IPC boundary

The webview asks the Rust side by calling `invoke()` from the Tauri
JS API. `invoke(commandName, args)` serializes `args` to JSON, sends
them over the IPC channel, the Rust side looks up the named command,
deserializes the arguments to the command's parameter types, calls
the function, serializes the return value back to JSON, and resolves
the JS-side promise with it.

A command is a Rust function annotated with `#[command]` (or
`#[tauri::command]`) and registered in the builder. The signature
declares what it expects. Here is the entry point Corpán uses to
fetch a single random phrase, abbreviated to show the contract:

```rust
// src-tauri/src/lib.rs:497
#[command]
fn get_random_entry_with_translations(
    app: AppHandle,
    state: State<'_, db::DbState>,
    pp_state: State<'_, PhrasePacksState>,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    language_codes: Option<Vec<String>>,
    phrase_pack_ids: Option<Vec<String>>,
    base_corpus_enabled: Option<bool>,
    exclude: Option<Vec<ExcludeEntry>>,
) -> Result<EntryOut, String> { ... }
```

Several things are happening for free here:

- `AppHandle` and `State<...>` are **injected** by Tauri. They are
  not sent over the wire; Tauri sees these parameter types and
  passes references to the live app handle and to managed state
  objects the builder set up with `.manage(...)`. The frontend does
  not (and cannot) supply them.
- `Option<Vec<String>>` parameters that the frontend omits arrive as
  `None`. The frontend does not have to send keys it does not care
  about.
- `Result<EntryOut, String>` becomes a JS promise. `Ok(value)`
  resolves; `Err(msg)` rejects with the string. There is no separate
  error channel; the type is the contract.

On the JS side, the same call looks like:

```ts
import { invoke } from "@tauri-apps/api/core";

const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
  levels: ["A1", "A2"],
  languageCodes: ["es", "en"],
});
```

Two conventions worth noting. JS uses camelCase
(`languageCodes`); Rust uses snake_case (`language_codes`). Tauri
applies the conversion automatically. The TypeScript type
(`EntryOut`) is a hand-written mirror of the Rust struct; nothing
generates it from the Rust side, which means the seam is the place
errors creep in if a struct changes on one side without the other.
This is one of the places sections 05 and 07 lean on each other.

### The builder

Every Tauri app composes itself in one place. In Corpán that is
`run()` at the bottom of `lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pack_db_state = PackDbState::new();
    let phrase_packs_state = PhrasePacksState::new();
    tauri::Builder::default()
        .manage(pack_db_state)
        .manage(phrase_packs_state)
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_game_packs::init())
        .invoke_handler(tauri::generate_handler![
            get_random_entry_with_translations,
            get_random_entries_with_translations,
            count_entries_for_filter,
            get_entry_by_id_with_translations,
            search_entries_by_translation_text,
            search_entries_by_translation_text_count,
            content_packs_query_db,
            content_packs_install_from_url,
            content_packs_fetch_text,
            content_packs_fetch_bytes,
            content_packs_list_installed,
            content_packs_get_manifest_url,
            phrase_packs_invalidate_cache,
            open_apple_feedback
        ])
        .plugin(tauri_plugin_safe_area_insets_css::init())
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_audio_keepalive::init())
        .plugin(tauri_plugin_radio_stream::init())
        .plugin(tauri_plugin_iap::init())
        .plugin(tauri_plugin_subscriptions::init())
        .plugin(tauri_plugin_stt::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| { /* open SQLite, manage db state */ })
        .build(tauri::generate_context!())
        .expect(...)
        .run(|_app_handle, event| { /* runtime event handler */ });
}
```

Read top to bottom: register two managed state objects so commands
can find them by type; install the plugins this app uses; declare
the fourteen commands the frontend can call; install the rest of
the plugins; run a setup hook that opens the bundled SQLite
database and adds its handle to managed state; build the app from
the config in `tauri.conf.json`; and finally enter the runtime
event loop.

`tauri::generate_handler!` is a macro that expands at compile time
into a single dispatcher that knows about every named command and
its parameter types. Adding a new command means writing the
function, adding its name to the macro's argument list, and
exporting the matching TypeScript type from `src/` for the
frontend to use.

### Capabilities

Tauri 2 separates "is the command compiled in" from "is the window
allowed to call it." Even with a command registered in
`invoke_handler`, the webview can only call it if the capability
file grants the right permission. The current capability file lives
at `src-tauri/capabilities/default.json` and lists permissions per
plugin. `tts:allow-speak` means the main window may invoke the
`speak` command on the TTS plugin; `core:default` rolls up the
baseline window operations.

This is the difference between an Electron app (which gives the
renderer the full Node API by default and asks the developer to be
careful) and a Tauri app (which whitelists each capability per
window). For a mobile-shipping app that bundles a SQLite database
of user-content the user did not author, the smaller default surface
is the right tradeoff.

### Android exit prevention

The runtime event handler at the bottom of `run()` is the most
production-incident-driven thirty lines in this codebase. The comment
in `lib.rs:1314` documents the chain of failures it prevents; the
short version:

- `tao` (the windowing crate Tauri uses through `wry`) ends its
  event loop by calling `std::process::exit()`.
- On Android, `std::process::exit()` runs `__cxa_finalize`, which
  invokes every C++ static destructor across `libhwui`, `libgui`,
  and OEM vendor libraries, on the event-loop thread, while the
  RenderThread, Mali GPU workers, and OEM singletons are still live.
- Those teardowns abort the process with
  `pthread_mutex_lock called on a destroyed mutex`, segfault in
  `Surface::connect` on a dead BufferQueue, or crash inside vendor
  destructors.
- `tauri-runtime-wry` raises `RunEvent::ExitRequested` before that
  exit, on any Android Activity `onDestroy` (which fires on a Back
  press, a swipe-from-recents, an OOM kill, or a config change).

The fix is a single line, inside the Android-only `cfg`:

```rust
.run(|_app_handle, event| {
    if let tauri::RunEvent::ExitRequested { api: _api, .. } = event {
        #[cfg(target_os = "android")]
        _api.prevent_exit();
    }
});
```

`prevent_exit()` keeps the event loop alive. Android then reclaims
the process through `SIGKILL` when it needs the memory back, which
runs no destructors and is race-free. Desktop platforms are
intentionally left to exit normally. The 7+ users hitting this
crash in `0.13.1` (per the comment) and the calm decision to vendor
a fork of `ndk-context` to remove an upstream assertion are the
adjacent fingerprints of the same incident.

This is included not for the fix itself but for the shape: a one-line
event handler with thirty lines of comment, born from production
crashes on real devices, citing the exact call stack. That is what
load-bearing prose around load-bearing code looks like.

## Common operations

1. **Run the app with hot reload.** From `corpan/corpan-app/`:
   `npm run tauri dev`. Vite watches React; Tauri rebuilds Rust on
   change.
2. **Type-check without running.** `cargo check` from
   `corpan-app/src-tauri/` for Rust, `npm run tsc` from
   `corpan-app/` for TypeScript. CI runs both.
3. **Add a new command.** Write the Rust function with `#[command]`,
   register it in the `invoke_handler!` list in `run()`, add the
   matching TypeScript types to the frontend, and call it from React
   via `invoke()`. If the command touches a plugin that needs new
   permissions, edit `capabilities/default.json` accordingly.
4. **Build a desktop binary.**
   `npm run tauri build`. Output in `corpan-app/src-tauri/target/release/`
   and `bundle/`.
5. **Build for iOS or Android.**
   `npm run tauri ios build` / `npm run tauri android build`. The
   first time on a fresh machine, Tauri runs `init` to fill out
   `gen/android/` and `ios/`; subsequent builds use them in place.
6. **Inspect what compiles together.**
   `cargo tree -p corpan` from `corpan-app/src-tauri/`. Shows the
   plugin paths (`../../plugins/...`) and the full transitive
   dependency graph.

## Why we built it this way

Tauri over Electron is the choice that opened mobile. Electron
bundles Chromium and Node for every install; the resulting desktop
binary is on the order of 100 to 200 MB before any application code,
and there is no Electron equivalent for iOS or Android at all. Tauri
ships a Rust binary that uses the OS's existing webview, so a
desktop Corpán binary is in the single-digit-megabytes range and the
same source tree builds for iOS and Android.

Rust on the privileged side and React in the webview is the
specialization split that pays for itself. The privileged work is
sharp-edged: open SQLite, hit HTTPS, spawn TTS, manage installed
packs on disk, talk to native IAP APIs. Rust's type system and
ownership model are exactly the discipline that those operations
need, and the cost (a slower edit cycle than pure JavaScript) is
absorbed by keeping Rust code small. The webview side is high-churn
UI work; React and TypeScript carry that load, and the IPC boundary
keeps the two paces from interfering with each other.

The capability system is the other quiet win. A mobile app that
downloads packs containing third-party JavaScript and serves them
through a custom URL scheme needs explicit answers to "what can that
JavaScript reach?" The default capabilities file is that answer in
one place. Tauri 1 did not have this; the Tauri 2 model is one of
the largest reasons the upgrade was worth doing.

The Android exit code is also why this stack is the right one.
Catching the crash required reading `tao` and `tauri-runtime-wry`
source, vendoring a crate, and writing thirty lines of comment that
the next maintainer (or agent) can read in place. None of that is
available when the application platform is a black box.

## To go deeper

- Tauri's own documentation at `v2.tauri.app` is in good shape;
  start with "Commands" and "Capabilities" and read the IPC pages
  before the plugin pages.
- `corpan/corpan-app/src-tauri/MANUAL.md` for incident-specific
  recipes that have not yet earned a real doc, and for iOS
  `Info.plist` adjustments the framework does not write.
- Read the comment at `lib.rs:1314` once a year. It is a small
  master class in writing prose that protects a fix that nobody
  remembers why they made.

---

# 05. Rust

## What it is

Rust is a systems programming language designed around a single
constraint: the compiler refuses to build any program that has a data
race, a use-after-free, or undefined behavior in safe code. It
achieves this by tracking, at compile time, who owns every value in
your program and how long every reference is allowed to live. The
compiler is strict; the resulting binary is not. Rust programs run at
the speed of C and C++ because the safety analysis happens before the
binary exists, not while it executes.

In this repo Rust lives in two places. It is the language of every
Tauri app's privileged side, which means it is the language of the
Corpán app's backend at `corpan/corpan-app/src-tauri/`, and it is the
language of every Tauri plugin (the seven of them in
`corpan/plugins/`). It is also the language of two sister Tauri apps,
`corpus-reader/src-tauri/` and `homeschool-offline/app/src-tauri/`.
Everywhere else in the repo, Rust is absent: the React UI is
TypeScript, the content corpus is Django and Python, the books are
Markdown and LaTeX, the shell glue is bash.

## How it fits

Rust on the privileged side of Tauri is the choice that lets the
host stay small. The corpan binary opens SQLite, makes HTTPS
requests, unzips packs onto the device's filesystem, talks to the
OS-native TTS and STT APIs, and serves files back to the webview
through a custom URL scheme. Every one of those operations is a
sharp-edged interaction with a resource the rest of the program does
not understand. Rust's ownership model is exactly the discipline that
those operations need: a SQLite connection has one owner, an HTTP
response body has one reader, and a downloaded zip is closed when its
handle drops. The compiler enforces this; the programmer does not
have to remember it.

The IPC boundary (section 04) is the point where Rust hands work to
or receives work from JavaScript. Everything on the Rust side of the
boundary is fully typed: each command declares its parameter types
and its return type, and serde does the conversion between JSON and
Rust structs in both directions. The TypeScript side mirrors those
types by hand. The "type" of the IPC seam is the union of the two
type systems; sections 05 and 07 together describe one shared
contract.

## Files and entry points

- `corpan/corpan-app/src-tauri/Cargo.toml`: the manifest of the app
  binary. Pins every dependency, points at the seven local plugins,
  declares the release profile, and patches `ndk-context` to a
  vendored fork (see section 04 for the Android exit story).
- `corpan/corpan-app/src-tauri/src/`: 2,431 lines of Rust across six
  files. `main.rs` is the entry point (six lines). `lib.rs` is the
  app's `run()` builder and the home of every `#[command]`. `db.rs`,
  `pack_db.rs`, `content_packs.rs`, and `phrase_packs.rs` are the
  modules `lib.rs` calls into.
- `corpan/plugins/<plugin>/`: seven Tauri plugins, each its own
  crate with its own `Cargo.toml`, `CHANGELOG.md`, `src/lib.rs`,
  `src/commands.rs`, and platform-specific files. The shapes are
  uniform; once you can read one, you can read all seven.
- `corpan/corpan-app/src-tauri/Cargo.lock`: present in the working
  tree but `.gitignore`d at the repo root, deliberately. The comment
  in `.gitignore` notes a `rusqlite`/`sqlx` member mismatch that
  prevents committing it without churn.
- `corpus-reader/src-tauri/` and `homeschool-offline/app/src-tauri/`:
  the two sister apps. Same Tauri-2 shape, smaller surface.

## How it works

Most of this subsection is a Rust primer using the STT plugin
(`corpan/plugins/tauri-plugin-stt/`) as the running example. The
plugin is 637 lines across six small files, every file under 220
lines, and it touches every major Rust idea: ownership, traits,
generics, conditional compilation, derive macros, error handling, and
the FFI bridge to native iOS and Android code. Read the plugin
alongside this section.

### Ownership, briefly

Every value in Rust has exactly one **owner**. When the owner goes
out of scope, the value is dropped (its destructor runs and its
resources are released). Assigning a value to a new binding **moves**
ownership unless the type implements the `Copy` trait, in which case
the value is copied. There is no garbage collector; there is no
reference counting by default; there is no shared mutable state
without explicit opt-in.

Borrowing is how a function can use a value without taking ownership.
`&T` is a shared reference (many readers allowed). `&mut T` is an
exclusive reference (one writer, no readers). The compiler enforces
that these never overlap. If a function signature borrows, the caller
keeps ownership.

The plugin's commands illustrate this:

```rust
// plugins/tauri-plugin-stt/src/commands.rs:11
#[command]
pub(crate) async fn prepare<R: Runtime>(
    app: AppHandle<R>,
    args: PrepareArgs,
) -> Result<PrepareResult> {
    app.stt().prepare(args.model)
}
```

`app` and `args` are moved into the function. `args.model` is moved
into the call to `prepare`. The function takes ownership of both and
gives back ownership of a `PrepareResult` (or an `Error`). There are
no lifetime annotations because none of these references outlive
the function call.

### Structs and derives

A `struct` is a named record. The IPC arguments and results for the
plugin live in `models.rs`:

```rust
// plugins/tauri-plugin-stt/src/models.rs:3
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareArgs {
    pub model: Option<String>,
}
```

A few things are happening here.

`#[derive(...)]` is an attribute macro. It tells the compiler to
generate code for the named traits. `Debug` gives you
`{:?}`-formatting for logging. `Clone` gives you a `.clone()` method.
`Serialize` and `Deserialize` come from serde; together they let this
struct travel as JSON on either side of the IPC boundary.

`#[serde(rename_all = "camelCase")]` controls the JSON shape. Rust
identifiers are snake_case by convention; JSON in this codebase is
camelCase. The rename keeps both sides idiomatic without anybody
writing string literals for keys.

`Option<String>` is Rust's null. There is no `null` in the type
system; the way to say "this is sometimes absent" is the `Option<T>`
enum with variants `Some(T)` and `None`. Code that wants to use the
inner value has to handle both cases, which means there is no class
of bug where you forget that something might be missing.

`pub` makes the field visible outside the module. Without `pub`,
fields are private to the file they are declared in.

### The serde rename war story

There is a docstring comment in `models.rs:188` worth reading at
least once, because it shows the texture of what plain-text comments
preserve. `StatusResult` has two memory-reporting fields:

```rust
// plugins/tauri-plugin-stt/src/models.rs:207
#[serde(default, rename = "availableMemoryMB")]
pub available_memory_mb: Option<i64>,
```

The naive way to write this is to lean on the struct-level
`#[serde(rename_all = "camelCase")]` and let serde do the
conversion. The problem is that serde reads `_mb` as one word and
emits `availableMemoryMb` (lowercase `b`). The native iOS and Android
plugins both emit `availableMemoryMB` (uppercase `MB`), because
"MB" is the conventional abbreviation. Without the explicit
per-field `rename`, serde silently drops the field on deserialization
and the JavaScript side sees `undefined`.

The comment around line 200 documents the trap, mentions that "it bit
us twice in the same week," and ties the lesson back to a sibling
issue on `PrepareResult`. Read it in place. The shape is the lesson:
prose that captures a bug class lives next to the code that protects
against it, so the next person to add a memory field does not learn
the same way.

### Enums and pattern matching

Rust enums are sum types: a value of an enum type is exactly one of
its variants. The plugin's error type is one:

```rust
// plugins/tauri-plugin-stt/src/error.rs:5
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[cfg(mobile)]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),
}
```

An `Error` is either an `Io` (carrying a `std::io::Error`) or a
`PluginInvoke` (carrying a `tauri::plugin::mobile::PluginInvokeError`,
only on mobile builds). Pattern matching on this enum exhausts both
cases:

```rust
match err {
    Error::Io(io) => { /* handle filesystem error */ }
    Error::PluginInvoke(p) => { /* handle plugin call error */ }
}
```

The compiler enforces that the match is **exhaustive**. If a new
variant is added later, every match site that does not handle it
fails to compile until it is brought up to date. This is the source
of one of Rust's most quoted properties: refactors that add new
states find their incomplete handlers automatically.

`#[derive(thiserror::Error)]` is the crate-of-the-month for ergonomic
custom error types. The `#[error(transparent)]` attribute makes the
enum delegate `Display` to the inner error, and `#[from]` lets you
write `?` (see below) to convert from the inner type without writing
a `match` by hand.

### `?` and the `Result` type

`Result<T, E>` is another enum: `Ok(T)` or `Err(E)`. Almost every
function in this codebase that can fail returns one. The plugin's
`Result` alias narrows it:

```rust
// plugins/tauri-plugin-stt/src/error.rs:3
pub type Result<T> = std::result::Result<T, Error>;
```

The `?` operator at the end of an expression means "if this is
`Err`, return it from the enclosing function; if it is `Ok`, unwrap
it." The mobile delegate uses this pattern in every call:

```rust
// plugins/tauri-plugin-stt/src/mobile.rs:30
pub fn prepare(&self, model: Option<String>) -> crate::Result<PrepareResult> {
    let args = PrepareArgs { model };
    self.handle
        .run_mobile_plugin::<PrepareResult>("prepare", Some(args))
        .map_err(|e| {
            println!("[MOBILE_STT] prepare error: {:?}", e);
            e.into()
        })
}
```

`run_mobile_plugin` returns a `Result<PrepareResult,
PluginInvokeError>`. The `map_err` transforms the inner error: it
logs it (the `println!` is intentional), then `e.into()` converts a
`PluginInvokeError` to the plugin's own `Error::PluginInvoke` variant
because the `#[from]` on the enum generates the `From` impl. The
result is a `crate::Result<PrepareResult>`. The function is six
lines including the log; the work happens in serde, in the macro,
and in the trait machinery.

### Traits and generics

A **trait** is a named collection of methods that any type can
implement. A **generic** is a type parameter that the compiler
specializes per call. Together they let you write code that operates
over many concrete types without inheritance.

The plugin's top-level public API is a trait:

```rust
// plugins/tauri-plugin-stt/src/lib.rs:26
pub trait SttExt<R: Runtime> {
    fn stt(&self) -> &Stt<R>;
}

impl<R: Runtime, T: Manager<R>> crate::SttExt<R> for T {
    fn stt(&self) -> &Stt<R> {
        self.state::<Stt<R>>().inner()
    }
}
```

`SttExt<R>` is a trait declaring one method, `stt(&self) -> &Stt<R>`.
The `impl` block implements `SttExt<R>` for **every** type `T` that
implements `tauri::Manager<R>`. The Tauri `AppHandle<R>` implements
`Manager<R>`, so the plugin's commands can write `app.stt()` to reach
the plugin's state without `AppHandle` knowing the plugin exists.
This is the "extension trait" pattern: add methods to types you do
not own.

`<R: Runtime>` is a generic parameter constrained to types that
implement the `Runtime` trait. Tauri uses this so the same plugin
source can compile against the real `Wry` runtime for shipping and
against a `MockRuntime` for tests. Without generics, the plugin
would need to commit to one runtime or duplicate its code.

### Modules and visibility

The Rust file system is the module system. A file `src/foo.rs` is a
module named `foo`, reachable from `lib.rs` by writing `mod foo;`.
`lib.rs` itself is the **crate root** for a library. `main.rs` is
the crate root for a binary. The STT plugin's `lib.rs:6` declares
its module tree:

```rust
#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;
```

`#[cfg(desktop)]` is a conditional-compilation attribute. The
`desktop` module is only included in the crate on desktop builds;
the `mobile` module is only included on mobile builds. The rest of
the plugin can then write:

```rust
#[cfg(desktop)]
use desktop::Stt;
#[cfg(mobile)]
use mobile::Stt;
```

…and the `Stt` type in scope is whichever one is right for the
current target. The desktop `Stt` is a stub that returns
`{ ready: false, message: "STT not supported on desktop in this build" }`.
The mobile `Stt` delegates each method to a native iOS or Android
plugin through `run_mobile_plugin`. The frontend does not know or
care which one it is talking to.

### `setup` and the plugin Builder

The plugin's `init()` function is the Tauri-plugin equivalent of
the app's `run()` (section 04):

```rust
// plugins/tauri-plugin-stt/src/lib.rs:39
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("stt")
        .invoke_handler(tauri::generate_handler![
            commands::prepare,
            commands::start_session,
            commands::stop_session,
            commands::cancel_session,
            commands::is_available,
            commands::get_status,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            { let stt = mobile::init(app, api)?; app.manage(stt); }
            #[cfg(desktop)]
            { let stt = desktop::init(app, api)?; app.manage(stt); }
            Ok(())
        })
        .build()
}
```

It registers six commands, runs a setup closure that constructs the
right `Stt` and parks it in app state, and builds. The app's
top-level builder (section 04) calls
`.plugin(tauri_plugin_stt::init())` to bring all of this into the
binary in one line.

### Cargo

`Cargo.toml` is the build manifest. The plugin's is twenty lines:

```toml
[package]
name = "tauri-plugin-stt"
version = "0.5.1"
edition = "2021"
links = "tauri-plugin-stt"

[dependencies]
tauri = { version = "2" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1"
thiserror = "2"

[build-dependencies]
tauri-plugin = { version = "2", features = ["build"] }
tauri-build = "2"
```

A few cargo-specific concepts are visible:

- `edition = "2021"` selects the language edition. Editions are
  opt-in incompatibilities; staying in 2021 means the same set of
  reserved keywords and macro behaviors as everything else in the
  repo.
- `links = "tauri-plugin-stt"` is the native-library link key; it
  makes the Tauri build process aware that this crate corresponds
  to a native plugin module the mobile build will load by name.
- `features = ["derive"]` opts into an optional code path of the
  dependency. serde without `derive` is a pure-runtime library;
  serde with `derive` brings in the macro crate that generates the
  `Serialize`/`Deserialize` impls.
- `[build-dependencies]` are crates used by `build.rs`, not by the
  crate itself. `tauri-build` invokes the Tauri build pipeline at
  compile time to generate the IPC glue.

The app's `Cargo.toml` is longer and uses **path dependencies** to
pull in the local plugins (`path = "../../plugins/tauri-plugin-stt"`).
Path deps are what make the monorepo work for Rust: edits to a
plugin source file are picked up by the next `cargo check` of the
app, no publish required.

### Macros

Two macro flavors show up. `derive` macros (`#[derive(Debug)]`,
`#[derive(Serialize)]`) generate trait impls from a struct or enum
declaration. Attribute macros (`#[command]`, `#[tauri::command]`,
`#[cfg(...)]`) transform the item they annotate. Procedural macros
in general run at compile time, take in token streams, and emit
token streams. You do not need to write a procedural macro for
years; you just need to know that the attributes are not free
decoration, they are code generators.

`tauri::generate_handler!` is a function-style macro. It expands at
compile time into a single dispatcher that knows the names, the
parameter types, and the return types of every command listed
inside it. The compile error you get from misspelling a command
name is therefore at the macro call site, not in the runtime
dispatcher.

## Common operations

1. **Read a plugin.** Start at `src/lib.rs`, find the `init()`
   function, follow the `invoke_handler!` list to `commands.rs`,
   follow each command into the desktop or mobile module, follow
   the args and results back to `models.rs`. The seven plugins
   in `corpan/plugins/` all have this same shape.
2. **Add a new field to an IPC type.** Edit the struct in
   `models.rs`. Add the field with a matching `#[serde(rename = ...)]`
   if the camelCase auto-conversion would produce the wrong name
   (the MB case above is the canonical example). Add a TypeScript
   field on the JS side to match (section 07). If the field is
   optional, wrap it in `Option<T>` and add `#[serde(default)]`.
3. **Add a new command.** Write the function in `commands.rs` with
   `#[command]`. Add its name to the `generate_handler!` list in
   `lib.rs`. Implement the underlying behavior in the desktop and
   mobile modules so both targets compile. Bump the plugin's
   `Cargo.toml` version and update its `CHANGELOG.md`.
4. **Type-check Rust.** `cargo check` from any Rust directory. It
   does the type analysis without producing a binary, so it is the
   fastest feedback loop.
5. **Format and lint.** `cargo fmt` to format,
   `cargo clippy --all-targets` to lint. The CI does not run these
   today; the discipline is local.
6. **Run a specific test.** `cargo test <name>` from the relevant
   crate. The Rust side of this codebase is undertested by design;
   the IPC seam is the natural test surface and most of it is
   exercised end-to-end through the app.

## Why we built it this way

Rust on the privileged side is the choice that lets the host stay
small and the seam stay strict. Every command that crosses from
JavaScript into Rust forces a decision: what is the type of this
input, what is the type of this output, what can go wrong. The
compiler will not let you defer those decisions. The cost is that
adding a command takes longer than adding an endpoint in a typical
Node server; the benefit is that the command works the first time
the React side calls it and it keeps working when the app
backgrounds, the device runs out of memory, and the user denies a
permission. The Android exit story in section 04 is a small example
of what is left after the compiler has done its job: rare, sharp,
documented, fixed.

The plugin shape is uniform on purpose. Every plugin has a
`lib.rs` with a trait extension and an `init()`. Every plugin has
a `commands.rs` with `#[command]` async functions. Every plugin has
a `models.rs` with serde structs. Every plugin has a `desktop.rs`
and a `mobile.rs` (sometimes one stubs the other). The uniform
shape means a new contributor can read one plugin and read the
other six in minutes, and a generated plugin from a future Tauri
template will probably land in the same shape without ceremony.

Plain-text Rust source files inside a monorepo with path
dependencies are the parts of this stack that resist the pull
toward NPM-style ecosystem complexity. There is no package
registry, no semver-range resolution, no peer-dependency dance.
There is one workspace, fourteen `Cargo.toml` files, and a single
`cargo check` that catches a type mismatch in a plugin before the
binary is rebuilt.

## To go deeper

- Steve Klabnik and Carol Nichols, *The Rust Programming Language*
  (the "book") at `doc.rust-lang.org/book`. Chapters 4 (ownership),
  10 (generics, traits, lifetimes), 17 (object safety, dyn), and 19
  (advanced features, macros) are the foundations that everything
  in this codebase is built on.
- Jon Gjengset, *Rust for Rustaceans*, when chapter 19 of the book
  is too short. The chapter on FFI applies directly to
  `tauri::plugin::mobile::PluginInvokeError` and the
  `run_mobile_plugin` bridge.
- `cargo doc --open` from inside any Rust crate in this repo. Cargo
  builds the API documentation for the crate and every transitive
  dependency, with cross-links between them. It is the single
  fastest way to learn what is in `tauri::plugin::*` or
  `rusqlite::*` without leaving your editor.
- The Rustonomicon at `doc.rust-lang.org/nomicon` for the day you
  need to know what `unsafe` actually buys you. Nothing in this
  codebase requires it; the vendored `ndk-context` fork is the
  nearest we come.

---

# 06. React

## What it is

React is a JavaScript library for describing user interfaces as
functions of state. Each component is a function that takes props
(its inputs) and returns a description of what the UI should look
like. React calls the function, compares the new description against
the last one, and writes the minimum set of changes into the DOM. The
programmer never writes DOM mutations directly; the programmer writes
"what the UI should look like right now," and React takes care of
"what to change."

This is the model that the React side of Corpán is built on. The
webview Tauri opens (section 04) loads a single HTML page, and that
page mounts a React tree at `<div id="root">`. The tree handles every
piece of UI in the app: the main phrase loop, the language settings
panel, the packs catalog, the onboarding flow, the pronunciation
coach surface. All of it is React components rendered by Vite-built
JavaScript talking to Rust through `invoke()`.

## How it fits

React is the inner layer of the host app. Tauri opens the window;
React fills it. Almost no Corpán-specific logic lives outside React:
state lives in Zustand stores, IPC calls happen from event handlers
and effects, navigation between screens happens by changing what
React renders. The packs that load at runtime (sections 10 through
15) are also typically React or React-adjacent, mounted into their
own container within the host React tree.

The interesting boundaries this section meets:

- The Tauri IPC boundary (section 04), where React calls `invoke()`
  to ask Rust for data.
- The state-management seam, where Zustand (chosen instead of Redux
  or context) keeps shared state in pure stores that components
  subscribe to with selectors.
- The TypeScript boundary (section 07), where every prop, every
  hook return value, and every IPC payload is typed.

## Files and entry points

- `corpan/corpan-app/index.html`: the single HTML page Tauri loads.
  Contains a `<div id="root">` and a `<script type="module"
  src="/src/main.tsx">` tag. The webview never navigates between
  HTML files; everything is one document.
- `corpan/corpan-app/src/main.tsx`: 58 lines, the mount point.
  Calls `ReactDOM.createRoot(...).render(<App />)`. Also wires
  `LanguageSynchronizer` around `<App />` and exposes a
  `__corpanDebug` object on `window` for ad-hoc inspection from
  Safari Web Inspector.
- `corpan/corpan-app/src/App.tsx`: 354 lines, the screen router.
  Picks between onboarding, the main experience, settings, packs,
  pronunciation coach, etc. based on settings store state.
- `corpan/corpan-app/src/components/MainExperience.tsx`: 648 lines,
  the home screen and the worked example for this section.
- `corpan/corpan-app/src/components/`: every other component. The
  `ui/` subdirectory holds primitives (Button, Dialog, etc., the
  shadcn/ui style); the `packs/` subdirectory holds pack-specific
  UI; the directory root holds screen-level components.
- `corpan/corpan-app/src/store/`: Zustand stores. `settings.ts`,
  `history.ts`, `rating.ts`, `phrasePacks.ts` and so on. Each is a
  module that exports a `useXStore()` hook.
- `corpan/corpan-app/src/hooks/`: custom hooks
  (`useScrollNavigation`, etc.) that encapsulate component-shaped
  logic without rendering anything themselves.
- `corpan/corpan-app/src/util/`, `src/utils/`, `src/lib/`: helpers,
  conversion functions, the TTS adapter, browser quirks. The dual
  `util/`/`utils/` exists because the codebase grew into both
  conventions; new code prefers `util/`.
- `corpan/corpan-app/src/contentPacks/`: the pack-loading bridge.
  Holds the host-side helpers that mount a pack into the React tree
  and broker its calls to the host API.
- `corpan/corpan-app/src/i18n.ts`: i18next setup. Translations are
  authored as JSON and loaded at startup.

## How it works

### Components are functions

A component is a JavaScript function whose name starts with a capital
letter and which returns JSX. JSX is sugar for `React.createElement`
calls; the compiler turns `<Button onClick={f}>Click</Button>` into
`React.createElement(Button, { onClick: f }, "Click")`. The argument
to the function is **props**, an object containing whatever the
caller passed in. Components compose: the return value of one
component can include other components.

```tsx
function MetaChips({ entry }: { entry: EntryOut }) {
    const { t, i18n } = useTranslation();
    // ...
    return (
        <div data-meta-chips ...>
            <span ...>{entry.level.toUpperCase()}</span>
            {entry.domains.map((d) => <span key={d}>{t(`categories.${d}`)}</span>)}
        </div>
    );
}
```

This is the `MetaChips` subcomponent inside `MainExperience.tsx`. It
takes one prop, `entry`, typed as `EntryOut`. It calls a hook
(`useTranslation`) to get translation functions. It returns a JSX
tree. That is the entire shape: function in, JSX out.

### Hooks are how a function holds state

A pure function cannot remember anything between calls. React solves
this with **hooks**: a small set of functions that, when called from
inside a component, hook into a per-component slot of memory React
maintains. The component is still a function, but the slots it draws
from are tied to its position in the React tree.

The five hooks `MainExperience` reaches for are the everyday set:

- `useState`: a piece of mutable state and a setter. Setting it
  triggers a re-render of the component.
- `useRef`: a mutable container that does **not** trigger a
  re-render when written. Used for "I need a value to survive
  re-renders but I don't want React to care about it." The
  `fetchSeqRef` in `MainExperience` is the canonical use: an
  always-incrementing integer that tracks which fetch is the most
  recent so a stale response can be discarded.
- `useEffect`: a function that runs after render. Pass a
  dependency array; the function re-runs whenever any dependency
  changes. The optional return value is a cleanup function that
  runs before the next re-run and on unmount.
- `useLayoutEffect`: same shape as `useEffect`, but runs
  synchronously after DOM mutations and before paint. Use it when
  you must measure or write to the DOM before the user sees the
  frame. `MainExperience` uses one to scroll back to the top of the
  current entry when the entry changes.
- `useCallback` and `useMemo`: stabilize the identity of a function
  or value across re-renders. The point is not performance; the
  point is to keep dependency arrays in **other** hooks honest.

A worked example from `MainExperience.tsx:286`:

```tsx
const resolveCurrent = useCallback(
    async (entry_id: number, source: string = "base") => {
        const mySeq = ++fetchSeqRef.current;
        try {
            const entry = await invoke<EntryOut>(
                "get_entry_by_id_with_translations",
                { entryId: entry_id, source },
            );
            if (entry && mySeq === fetchSeqRef.current) setCurrEntry(entry);
        } catch (err) {
            // ... recovery: substitute a same-filter random entry ...
        }
    },
    [levels, phrasePackIds, baseCorpusEnabled, replaceCurrent],
);
```

Six things happening here:

1. `useCallback` returns the same function reference across renders
   as long as the dependency array (`[levels, phrasePackIds,
   baseCorpusEnabled, replaceCurrent]`) does not change.
2. `++fetchSeqRef.current` captures the sequence number for **this**
   call. Two `resolveCurrent` calls in flight at once can be told
   apart by comparing their captured `mySeq` to the current
   `fetchSeqRef.current`.
3. `await invoke<EntryOut>(...)` is the Tauri IPC call. The generic
   parameter (`<EntryOut>`) tells TypeScript the resolved type; Rust
   actually decides it.
4. The `if (entry && mySeq === fetchSeqRef.current)` guard is the
   anti-stale-write check: a slower response that arrives after a
   newer one would have incremented `fetchSeqRef.current` further,
   so its stored `mySeq` no longer matches and it is silently
   dropped instead of overwriting the displayed entry.
5. The `catch` branch handles a specific failure (the entry has
   been removed from the corpus while it sits in history) by
   substituting a random replacement. The comment in place is a
   short essay on why this is necessary; read it for the texture.
6. The dependency array contains every variable the callback
   captures from the surrounding scope. ESLint's
   `react-hooks/exhaustive-deps` rule polices this; missing
   dependencies produce stale closures, the single most common
   React bug class.

### The rendering model

When state changes, React re-runs the component function from the
top. Every line runs again, every variable is recomputed, every JSX
node is freshly constructed. The output is compared to the previous
render, and only differences are applied to the DOM. This sounds
expensive and is not: building plain objects is fast, and the
DOM diff is the part that actually touches the browser.

This is the model that gives React its declarative feel. You do not
write "the user clicked next, so move the focus to the next button."
You write "the current entry is whatever is at `index` in the
history; if `index` changes, the entry changes; React figures out
what to redraw." Effects, refs, and memoization are the escape hatches
for the cases where the model is not enough.

### Zustand and selectors

Component-local state lives in `useState`. State that two components
need to share lives in a Zustand store. Zustand is a 4-kilobyte
state management library whose model is a single observable object
exposed through a hook. The Corpán app has several:

```tsx
import { useSettingsStore } from "@/store/settings";

// inside MainExperience:
const activeStackId = useSettingsStore((s) => s.activeStackId);
const languages    = useSettingsStore((s) => s.languages);
const levels       = useSettingsStore((s) => s.levels);
```

The argument to `useSettingsStore` is a **selector**: a function
that picks the piece of store state this component cares about.
Zustand subscribes the component only to the selected piece. When
the selected value changes (by referential identity), the component
re-renders; when other parts of the store change, it does not.

This is the "subscribe to a slice" pattern that Redux popularized,
without the boilerplate. Stores are plain objects; setters live on
the store itself; persistence to `localStorage` is a one-line
middleware. The Zustand stores under `corpan/corpan-app/src/store/`
are the durable state of the app: settings, history, ratings,
installed phrase packs, etc.

### Effects and the loop

`MainExperience` runs three `useEffect` calls that drive the loop:

```tsx
// On stack switch: clear view, then either load existing selection
// or fetch a new random entry.
useEffect(() => {
    setCurrEntry(null);
    if (ids.length === 0) {
        void fetchRandomEntry();
    } else if (index >= 0 && index < ids.length) {
        void resolveCurrent(ids[index], sources[index] ?? "base");
    }
}, [activeStackId]);

// Re-fetch the same entry when the language list changes.
useEffect(() => {
    if (index >= 0 && index < ids.length) {
        void resolveCurrent(ids[index], sources[index] ?? "base");
    }
}, [languages]);
```

Each `useEffect` has a clear shape: condition on the dependency,
do something side-effectful (fetch from Tauri, log analytics,
adjust layout), optionally clean up. The `void` prefix is there
to tell ESLint that the returned promise is intentionally
unawaited. Inside the effect, Rust is called through `invoke`, and
on resolution the React state is updated through `setCurrEntry`,
which triggers a re-render that uses the new entry. The loop is
closed.

### Strict mode

`main.tsx` wraps `<App />` in `<React.StrictMode>`. In development,
StrictMode renders every component **twice** to surface side effects
in render functions and stale assumptions in effects. In production
it does nothing. The double-render is the reason effects must be
idempotent and the reason `initAnalytics()` lives at the bottom of
`main.tsx` outside the React tree (the comment makes the
HMR-idempotence promise explicit).

### Why a webview UI and not a native one

The Corpán app could in principle be written with SwiftUI on iOS,
Jetpack Compose on Android, and an Electron equivalent on desktop;
each platform has a first-party UI toolkit. The cost would be three
separate UIs and three separate places to ship a bug fix. React
inside a Tauri webview costs a small amount of performance and one
extra abstraction (the webview is not a "real" native control), and
buys one UI surface for every platform Corpán ships to.

For Corpán specifically, the UI is mostly text. Phrases, language
labels, controls. The native-vs-webview gap is widest on
high-interaction surfaces (gestures, scrolling lists, instant
hardware-accelerated transitions) and narrowest on text-rendering
surfaces; the app sits comfortably on the narrow side.

## Common operations

1. **Add a screen.** Create a component file under
   `corpan/corpan-app/src/components/`. Render the new screen from
   `App.tsx` conditional on a settings flag or a route state.
   Subscribe to whichever Zustand stores it needs.
2. **Add a piece of shared state.** Edit the relevant store under
   `src/store/`. Add a field to the store's state type, a setter,
   and any persistence config. Components opt in by adding a
   selector.
3. **Call Rust from a component.** Import `invoke` from
   `@tauri-apps/api/core`. Call it inside an event handler or
   inside `useEffect`. Use the generic parameter to annotate the
   return type (`await invoke<EntryOut>("name", { args })`). Mirror
   the Rust struct as a TypeScript type at the top of the file.
4. **Stop a stale fetch from overwriting fresh state.** Use the
   `fetchSeqRef` pattern: bump a ref at the start, compare to the
   ref before writing back state. See `MainExperience:286` for
   the canonical site.
5. **Memoize a derived value.** `useMemo(() => buildLookup(entry),
   [entry])` reruns `buildLookup` only when `entry` changes. The
   benefit is keeping the **identity** of the returned object stable
   across re-renders, so downstream dependency arrays do not churn.
6. **Avoid re-rendering on unrelated store changes.** Make the
   selector narrow. `useStore((s) => s.activeStackId)` re-renders
   when `activeStackId` changes; `useStore((s) => s)` re-renders
   when **anything** in the store changes.

## Why we built it this way

React inside the webview is the choice that maps the cross-platform
nature of the app onto one UI codebase. Everything in
`corpan-app/src/` runs on iOS, Android, macOS, Windows, and Linux
unchanged, because the React tree is unaware of which webview is
hosting it.

Zustand instead of Redux is a choice in favor of the smallest model
that does the job. Stores are 30 lines apiece. State updates do not
go through reducers; they are method calls on the store. Selectors
keep components subscribed only to what they read, which is what
Redux's `mapStateToProps` was supposed to do but rarely did in
practice.

`useCallback` and `useMemo` are used not for performance but as
the type system inside React's rendering model. They give a stable
identity to functions and objects so that the dependency arrays of
other hooks behave correctly. The cost (boilerplate) is real; the
benefit (no stale closures, no infinite re-render loops) is the
difference between a stable app and an app that crashes when a
user changes their language preference.

Hooks over class components is React's own evolution, but it is
also the right shape for this codebase. A component's data flow
(read this prop, subscribe to this store slice, run this effect on
change) is local to the function body and shows up in order. The
"this" of a class did not.

## To go deeper

- The official React docs at `react.dev` are excellent. Start at
  "Quick Start," then "Thinking in React," then the "Reference"
  section for each hook. The new docs (post-2023) finally explain
  the rendering model honestly; older tutorials often did not.
- Dan Abramov, *Just Javascript* (online, free at
  `justjavascript.com`). Twenty short modules that fix the
  prerequisites the React docs assume. Worth the few hours for
  anyone whose JS feels like cargo-culting.
- The `@tauri-apps/api` JS reference at
  `v2.tauri.app/reference/javascript/`. Most of what React in this
  app does at the IPC seam is in the `invoke` and `event` modules.
- Read `App.tsx` and `MainExperience.tsx` end to end at least once.
  The first is the screen router; the second is the loop. Together
  they are the spine of the Corpán app UI.

---

# 07. TypeScript

## What it is

TypeScript is JavaScript with a static type system bolted on top. A
TypeScript file (`.ts`, or `.tsx` when it contains JSX) is a
JavaScript program plus type annotations the compiler checks before
the program runs. The compiler erases the annotations and emits
plain JavaScript; the runtime behavior is identical to the same code
without types. The work is all at edit-time and at compile-time. The
gain is that a category of bugs that JavaScript catches at runtime
(missing properties, wrong argument types, typos in field names)
either fail to compile or fail to type-check, often the second the
mistake is made in the editor.

In this repo TypeScript runs everywhere JavaScript could have. The
Corpán React app is TypeScript. The Tauri JS APIs come with hand-
written `.d.ts` files. The pack SDK ships as a `.js` runtime plus an
`index.d.ts` of type-only declarations. The Next.js marketing site
under `web/io/` is TypeScript. The dev tooling under `web/scripts/`
is plain Node JavaScript, deliberately, because there is no React
or build pipeline calling into it. Whenever there are types to keep
honest, the answer is TypeScript.

## How it fits

TypeScript is the language of the seam. The IPC boundary in section
04 is a contract; one half lives in Rust structs, the other in
TypeScript types, and `serde` keeps them in alignment over JSON. The
Pack Host API (section 12) is a contract; the host implements it in
TypeScript and every pack imports the same `HostApi` type from the
SDK. The React component tree (section 06) is a contract between
parent and child, prop by prop, all typed.

Most architectural choices in the React app fall out of TypeScript
being strict. Zustand stores expose typed selectors; `invoke()` is
called with a generic parameter that fixes the return type; the
pack manifest is parsed against a type. When a refactor changes a
struct on the Rust side, the corresponding TypeScript type change
turns into a list of compile errors that points at every site that
needs to follow.

## Files and entry points

- `corpan/corpan-app/tsconfig.json`: the configuration for the app.
  Strict mode is on, no unused locals, no unused parameters, no
  fallthrough cases, `isolatedModules: true`, `noEmit: true`
  (Vite handles the emit), and path aliases (`@/* -> src/*`,
  `@shared/* -> ../packs/shared/*`).
- `corpan/corpan-app/tsconfig.node.json`: the configuration for
  Vite's own Node-side tooling. Referenced by `tsconfig.json` so
  the main project can `references: [./tsconfig.node.json]`.
- `corpan/corpan-app/src/`: every `.ts` and `.tsx` file in the app.
- `corpan/corpan-app/vite-env.d.ts`: ambient declarations Vite
  expects (the `import.meta.env` shape, etc.).
- `corpan/corpan-app/src/i18next.d.ts`: an example of a typed
  augmentation. Tells i18next about the keys this app uses so
  `t("categories.travel")` is autocompleted and typo-checked.
- `corpan/packs/sdk/index.d.ts`: the canonical pack contract. 223
  lines of types and three function signatures with no
  implementations. The worked example for this section.
- `corpan/packs/sdk/package.json`: declares `"types":
  "./index.d.ts"` so anything that imports `@corpan/sdk` picks up
  the type declarations automatically.
- `web/io/tsconfig.json`: a different tsconfig for the Next.js site.
  Same strictness; different module resolution.

## How it works

### Types are descriptions, not classes

The single biggest stumble for an apprentice arriving from
class-based languages is that a TypeScript type is **not** a class.
It is a shape. A value satisfies a type if it has the right shape;
there is no `instanceof`-style check that the runtime cares about.
This is called **structural typing**, and the SDK's
`index.d.ts` shows it in pure form:

```ts
// corpan/packs/sdk/index.d.ts:17
export type EntryOut = {
  entry_id: number
  level: string
  domains: string[]
  translations: TranslationOut[]
  /** "base" for the bundled corpus, or a phrase-pack id. */
  source: string
}
```

Anything that has an `entry_id` (number), a `level` (string), and a
`source` (string), with the right shapes for `domains` and
`translations`, **is** an `EntryOut`. There is no inheritance, no
class hierarchy, no annotation on the object itself. The Rust struct
on the other side of the IPC boundary does not know this type
exists; it serializes its data, the JSON arrives at the webview, and
the TypeScript compiler accepts it because the shapes match.

This is how the IPC seam stays honest with no codegen between the
two halves. Rust says "I emit a struct with these fields";
TypeScript says "I receive an object with these fields"; serde and
the React runtime broker the exchange.

### Union types and string literals

A `type` can be a union of other types. The SDK uses this for error
codes:

```ts
// corpan/packs/sdk/index.d.ts:44
export type SttErrorCode =
  | "MODEL_NOT_INSTALLED"
  | "MODEL_NOT_LOADED"
  | "NETWORK"
  | "LOAD_FAILED"
  | "IO_FAILED"
  | "BUSY"
  | "CANCELLED"
  | "MIC_PERMISSION_DENIED"
  | "NO_ACTIVE_SESSION"
  | "AUDIO_FAILED"
  | "UNKNOWN"
```

Every value of type `SttErrorCode` is one of those exact strings. A
function that takes an `SttErrorCode` will refuse `"unknown"` (wrong
case), `"NETWORK_FAILURE"` (not in the list), or `42` (not a
string). A `switch` on an `SttErrorCode` value is exhaustively
checkable: TypeScript can warn if you forgot a case.

The same idea drives optional fields. `code?: SttErrorCode` means
the field may be present or absent. Reading it gives you
`SttErrorCode | undefined`; you have to narrow before you use it.
This is the analogue of Rust's `Option<String>` (section 05). The
compiler will not let you forget the case where the value is missing.

### Function types

Functions are values, and value types describe them. The SDK's
`HostApi` is mostly a record of function types:

```ts
// corpan/packs/sdk/index.d.ts:159
export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById: (entryId: number, source?: string) => Promise<EntryOut>
  // ... and so on
  stt?: SttApi
  isMock?: boolean
}
```

Read each field as a contract:

- `speak: (uiCode: string, text: string) => Promise<void>` is a
  function the host promises to provide, which takes two strings
  and returns a `Promise` that resolves to nothing.
- `onStackConfigChange: (listener: (config: StackConfig) => void)
  => () => void` is a higher-order function. It takes a listener
  callback and returns an unsubscribe function. The shape
  documents the lifetime contract: "I will call your listener
  with the new config; call the returned function to stop being
  called."
- `getRandomEntries?: (count: number) => Promise<EntryOut[]>` has a
  `?` on the field, meaning the host may or may not implement it.
  A pack that wants to use it has to check.

This is the entire pack-host contract. Any host that returns an
object matching this type can host any pack, and any pack that
imports this type can be hosted by any host. There is no runtime
glue beyond the shape itself.

### Generics

A generic type is a type with a parameter. The Tauri IPC call is
generic over its return type:

```ts
const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
  levels: ["A1", "A2"],
});
```

`invoke` is declared (in `@tauri-apps/api/core`) roughly as:

```ts
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
```

`<T>` is a placeholder; when you call `invoke<EntryOut>(...)`,
TypeScript substitutes `EntryOut` everywhere `T` appears, so the
return type is `Promise<EntryOut>`. The runtime does no checking;
the JSON that arrives is trusted to match. The discipline is on the
caller to keep the TypeScript annotation aligned with the Rust
struct.

The pack SDK uses generics sparingly because most of its types are
concrete records. The Rust side leans on generics more (section 05);
TypeScript leans on union types more.

### Utility types

TypeScript ships a small library of built-in **utility types** that
manipulate existing types. The SDK uses one of them in
`createMockHostApi`:

```ts
// corpan/packs/sdk/index.d.ts:210
export function createMockHostApi(options?:
  Partial<HostApi> & {
    stackConfig?: Partial<StackConfig>
  }
): HostApi
```

`Partial<HostApi>` is "every field of `HostApi`, but all of them are
optional." That is what a mock wants: the caller fills in the
methods they care about and the factory provides defaults for the
rest. `&` is type intersection: the argument is both a `Partial
HostApi` **and** a record with an optional `stackConfig`. The
returned value is a full `HostApi`, not a partial one; the factory
fills in the gaps.

The standard library also gives you `Pick<T, K>` (subset of fields),
`Omit<T, K>` (everything but those fields), `Required<T>` (the
opposite of `Partial`), `Record<K, V>` (a map type), and
`ReturnType<F>` and `Parameters<F>` (introspecting function types).
You will reach for these once a week.

### Ambient declarations (`.d.ts`)

A `.d.ts` file contains type declarations only; no runtime code. The
SDK's package layout is the cleanest example:

```
corpan/packs/sdk/
├── index.js        ← the runtime, plain JS
├── index.d.ts      ← the type declarations
├── package.json    ← "main": "./index.js", "types": "./index.d.ts"
└── ...
```

A pack that does `import { HostApi } from "@corpan/sdk"` resolves
the import path through `package.json` and sees both files. The
TypeScript compiler uses `index.d.ts` for type information; the
runtime uses `index.js` for behavior. The pack's bundler bundles
`index.js`; the types are erased.

`.d.ts` files are also where you teach TypeScript about modules
that did not originally ship with types, or about ambient runtime
features like Vite's `import.meta.env`. The app's
`vite-env.d.ts` is such a file. They are not a hack; they are the
intended seam for "this is true about the world; trust me."

### Strict mode and the tsconfig

The app's `tsconfig.json` turns on several gates worth knowing:

```jsonc
{
  "compilerOptions": {
    "strict": true,             // everything below it, plus more
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,    // each file compiles standalone
    "noEmit": true,             // Vite emits; tsc only checks
    "jsx": "react-jsx",         // modern JSX transform, no React import needed
    "moduleResolution": "bundler",
    "paths": {
      "@/*":      ["src/*"],
      "@shared/*": ["../packs/shared/*"]
    }
  }
}
```

Read these as gates:

- `strict` enables `strictNullChecks` (you cannot pass `null` where
  the type does not allow it), `noImplicitAny` (no type-system
  escape hatch by omission), and several others. This is the
  single setting that separates a serious TypeScript codebase from
  a JS-with-type-decoration codebase.
- `noUnusedLocals` and `noUnusedParameters` keep the code honest;
  `_arg` and `_unused` are conventional opt-outs.
- `isolatedModules` is what makes single-file transpilers (Vite,
  esbuild) work. It forbids constructs that rely on whole-program
  knowledge.
- `noEmit` plus a Vite build is the pattern: `tsc --noEmit` is the
  type checker, `vite build` is the bundler. CI runs them
  separately so a type error is a CI failure, not a runtime one.
- The `paths` aliases (`@/` and `@shared/`) are resolved by both
  the TypeScript compiler and Vite. They keep imports short and
  refactor-friendly.

### The compiler as your pair

The largest day-to-day benefit of TypeScript is the editor surface
it produces. Hover any expression in VS Code (or Neovim with a TS
language server) and the inferred type appears. Rename a field on
the `EntryOut` type and every consumer is highlighted as a
compile error until updated. Add a new variant to the `SttErrorCode`
union and every exhaustive `switch` on `SttErrorCode` is flagged.

A worked sequence the codebase walks routinely:

1. Add a field to a Rust struct in `corpan/corpan-app/src-tauri/src/lib.rs`
   (with the appropriate `#[serde(rename = ...)]` if camelCase
   conversion needs help).
2. Run `cargo check` from `src-tauri/`. Rust side compiles.
3. Edit the matching TypeScript type in the consumer
   (often `EntryOut` in `MainExperience.tsx` or `index.d.ts`).
4. Run `npm run tsc` from `corpan-app/`. Every consumer of the
   changed type either compiles cleanly or shows a compile error
   at the call site.
5. Fix the call sites; re-run `tsc`; iterate.

That is the loop. The Rust and TypeScript compilers are pair
programmers and the seam between them is the place errors fall out.

## Common operations

1. **Type-check the app.** `npm run tsc` from
   `corpan/corpan-app/`. Maps to `tsc --noEmit`. CI runs this on
   every PR that touches the app.
2. **Add a type for an IPC return value.** Write a `type EntryOut =
   {...}` at the top of the consumer (or import from the SDK if
   it is a shared shape). Pass it as the generic parameter to
   `invoke<EntryOut>(...)`.
3. **Narrow an optional.** Use a truthiness check: `if (e.code)
   { /* e.code is SttErrorCode here */ }`. TypeScript flow-narrows
   inside the conditional.
4. **Mirror a Rust struct in TypeScript.** Translate snake_case to
   camelCase if Rust's `#[serde(rename_all = "camelCase")]` is on
   that struct; keep snake_case if not. (Most of Corpán's structs
   are renamed; the EntryOut shape on the wire is snake_case for
   historical reasons, which is why `entry.entry_id` and
   `entry.language_code` appear as such on the React side.)
5. **Add a path alias.** Edit `paths` in `tsconfig.json` and the
   matching `resolve.alias` in `vite.config.ts`. They have to
   agree; the compiler does not check Vite's config and vice versa.
6. **Suppress a single line.** `// @ts-expect-error <reason>`
   above the line. TypeScript fails the compile if the error is
   gone (catching the cleanup opportunity). Prefer this to
   `// @ts-ignore`, which fails silently when the error goes away.

## Why we built it this way

TypeScript is strict here because the IPC seam needs it. JavaScript
would let a Rust schema change pass into the React tree as
`undefined.field` at runtime, and the bug would show up in the
webview an hour later as a blank screen with a console error. With
strict mode on, the schema change becomes a compile error in the
same PR that introduces it.

`.d.ts` for the pack SDK is the choice that decouples shipping the
SDK runtime from shipping the SDK types. A pack can import the type
of `HostApi` without bundling any of the SDK's code; the host can
implement the type without ever instantiating the SDK. Types as a
separate artifact is what makes this clean.

Structural typing matches the wire-format reality. The Rust side
hands JSON; the TypeScript side receives JSON. Neither is a
class. Asking "does this object have the right shape?" is asking
the right question; asking "is this an instance of the right
class?" would be asking the wrong one.

`noEmit: true` plus Vite is the build split this codebase trusts.
`tsc` does one job (type-check); Vite does the other (bundle and
serve). When something is wrong, you know whether to look at the
types or at the bundler. Mixing them, as some setups do, makes
both harder to debug.

## To go deeper

- The official handbook at `typescriptlang.org/docs/handbook/2/`.
  The "Everyday Types," "Narrowing," and "Object Types" pages cover
  ninety percent of the patterns in this codebase.
- The TypeScript Playground at `typescriptlang.org/play`. Paste
  the SDK's `index.d.ts` in and hover types; the inference tree is
  the same one your editor uses.
- Marius Schulz, *Advanced TypeScript* (blog series at
  `mariusschulz.com/blog`), for the day you want conditional types,
  template literal types, or `infer`. Nothing in the Corpán app
  needs them today; some packs touch them.
- Matt Pocock's *Total TypeScript* free tier (`totaltypescript.com`)
  is the most concentrated way to learn the type-only patterns the
  language has accreted over the last few years.

---

# 08. Vite

## What it is

Vite is the build tool the Corpán app uses. In development, it runs
a local HTTP server that serves the source files as native ES
modules to the browser, with hot module replacement for instant
updates. In production, it bundles the same source tree into a
small set of optimized files for shipping. The two modes share a
configuration file and a plugin system; what differs is the
underlying engine. Dev mode is powered by `esbuild` (a Go-implemented
bundler that operates in milliseconds); production builds are powered
by `Rollup` (a JavaScript bundler that does the deeper tree shaking
and chunking that shipping wants).

In this repo Vite drives `corpan/corpan-app/` (the Tauri-hosted React
frontend) and each pack under `corpan/packs/` (each pack is its own
Vite project). The Next.js marketing site at `web/io/` is **not** a
Vite project; Next.js has its own build pipeline (still Webpack-
based under the hood). The static Corpán pages at `web/pages/` are
not Vite either; they are templates assembled by hand-rolled Node
scripts (`web/pages/build.js`). The pattern is: where there is a
React or React-like frontend that needs hot reload, Vite. Where the
output is server-rendered or template-stitched, something else.

## How it fits

Vite sits between TypeScript source and a running browser. Tauri
(section 04) is configured to point its webview at Vite's dev server
URL during development (`http://127.0.0.1:1421`, declared in
`tauri.conf.json`) and at the static build output (`../dist`,
produced by `vite build`) in production. So `npm run tauri dev`
starts Vite and launches the Tauri binary; the binary opens a webview
on Vite's URL; edits to React or CSS files flow through Vite's HMR
into the running webview, with no app restart.

The pack story is the same shape one level smaller. Each pack's
`vite.config.ts` produces a `dist/` directory that the root build
orchestrator (section 02) copies into `web/io/out/corpan/packs/`,
then zips. During pack development, a pack's `npm run dev` launches
Vite on a different port and the developer uses Tauri's "install
from URL" path (section 02) to load that local URL into the running
app.

## Files and entry points

- `corpan/corpan-app/vite.config.ts`: the Vite config for the app.
  135 lines, dense. Worked example for this section.
- `corpan/corpan-app/index.html`: the single HTML document Vite
  treats as the **entry point**. Contains the
  `<script type="module" src="/src/main.tsx">` tag that pulls the
  whole React tree.
- `corpan/corpan-app/package.json`: declares the `dev`, `build`,
  and `tauri` scripts. `dev` runs `vite`; `build` runs
  `vite build`; `tauri dev` is the orchestrator that calls into
  both.
- `corpan/corpan-app/dist/`: the build output. Created by
  `vite build`; embedded by Tauri in release builds. Not tracked
  in git.
- Each pack's `vite.config.ts`: similar shape, scoped to one pack.
  See `corpan/packs/hover-runner/vite.config.ts` for the
  reference.
- `corpan/corpan-app/tsconfig.node.json`: a separate tsconfig for
  the Vite config file itself (it runs in Node, not the browser).

## How it works

### What "native ESM" buys

Before Vite, the dominant pattern was Webpack-style **bundling**: a
build step that walked the import graph, gathered every file into a
single bundle (or a few code-split bundles), and served that to the
browser. The bundle was rebuilt on every change. As a project grew,
the cold-start time grew with it; large React projects with a few
hundred files routinely waited tens of seconds for the dev server
to come up after a save.

Vite's insight is that the browser already understands ES modules.
A `<script type="module" src="/src/main.tsx">` tag in `index.html`
makes the browser fetch `main.tsx`, then fetch each module it
imports, recursively. Vite's dev server intercepts these fetches and
transforms each file on demand: TypeScript and JSX are compiled to
modern JavaScript by `esbuild`, CSS is processed, and the result is
sent back. Each file is transformed once and cached. There is no
"the bundle." There is a graph of small files served independently.

The consequence is that startup time becomes O(time to compile the
single file the user is editing) instead of O(time to bundle the
whole project). On a project the size of the Corpán app (several
hundred TypeScript files), the dev server is interactive in well
under a second; an edit lands in the running webview before the
finger leaves the save key.

### HMR

Hot module replacement is the live-edit pipeline. When a file
changes, Vite recompiles just that file, sends it to the browser
over a WebSocket, and the browser swaps the new module in **without
reloading the page**. For React, this means component state is
preserved across edits. The button you were hovering does not jump
back to the home screen.

The HMR config in `vite.config.ts` is sensitive to the network
arrangement:

```ts
// corpan/corpan-app/vite.config.ts:116
server: {
    port: 1421,
    strictPort: true,
    host: serverHost,
    hmr: rawHost
        ? { protocol: "ws", host: rawHost, port: 1421 }
        : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
},
```

`port: 1421` matches `tauri.conf.json`'s `devUrl`; the two **must**
agree or the webview cannot find the dev server. `strictPort: true`
fails fast if 1421 is busy, rather than silently picking 1422 and
leaving Tauri pointing at the wrong place. `host: serverHost` is
either `127.0.0.1` for desktop or `0.0.0.0` (set via
`TAURI_DEV_HOST` from outside) so an Android device on the same LAN
can reach the dev server. `watch: { ignored: ["**/src-tauri/**"] }`
keeps the file watcher from waking up on Rust edits that Vite would
have nothing to say about.

### Plugins

Vite plugins are objects with hooks: `config`, `configureServer`,
`transform`, `buildStart`, and so on. Each hook runs at a specific
moment in the dev or build pipeline. The Corpán config uses three
plugins:

```ts
plugins: [react(), tailwind(), servePacks()],
```

- `react()` is `@vitejs/plugin-react`. It enables JSX and the React
  Fast Refresh integration that makes HMR component-aware. Without
  it, an edit to a component would replace the module but lose all
  state.
- `tailwind()` is `@tailwindcss/vite`. Tailwind v4 runs through
  Vite's transform pipeline; it scans the source for class names
  and emits the CSS for exactly the ones in use. See section 09
  for the styling story.
- `servePacks()` is a small custom plugin defined in the same
  file. It is the most interesting one to read.

The custom plugin:

```ts
// corpan/corpan-app/vite.config.ts:47
const servePacks = () => ({
    name: "serve-corpan-packs",
    configureServer(server: any) {
        server.middlewares.use("/packs", serveStaticFromRoot(packsRoot));
        server.middlewares.use("/corpan/packs", serveStaticFromRoot(outPacksRoot));
        server.middlewares.use("/game-proxy", async (req, res) => {
            // proxy to an external pack URL
        });
    },
});
```

`configureServer` hands you Vite's connect-style middleware stack.
The plugin attaches three handlers:

- `/packs` serves files from `../packs` (the sibling `corpan/packs/`
  directory), so during dev the app can fetch a pack as
  `http://127.0.0.1:1421/packs/hover-runner/manifest.json` and
  load it just like the production URL on `encorpora.io`.
- `/corpan/packs` serves files from the production build output at
  `web/io/out/corpan/packs`, so a developer with a built bundle
  can also point the app at a packaged pack locally.
- `/game-proxy` does a small fetch-and-relay for arbitrary URLs,
  used during pack development to test loading from a remote URL
  without CORS issues.

This is the plugin system in microcosm. No transform, no bundle, no
ceremony, just three middleware handlers attached at the right
moment. The whole "make local pack development work" feature is
one plugin and forty-odd lines.

### Path aliases

The same `@/` and `@shared/` aliases that `tsconfig.json` declares
also need to be declared to Vite, because the TypeScript compiler
and Vite resolve imports independently:

```ts
resolve: {
    alias: {
        "@":       fileURLToPath(new URL("./src", import.meta.url)),
        "@shared": fileURLToPath(new URL("../packs/shared", import.meta.url)),
    },
},
```

These two configurations (`tsconfig.json:paths` and
`vite.config.ts:resolve.alias`) must stay in sync. The compiler will
not warn if they diverge; a wrong alias here surfaces as a runtime
"failed to fetch" in the webview. Updating either is small enough
that the discipline is to update both.

### Production build

`vite build` runs Rollup over the same entry (`index.html` and its
transitive imports) and produces an optimized bundle:

```ts
build: {
    target: "es2020",
    minify: "esbuild",
    rollupOptions: {
        output: {
            manualChunks: {
                vendor: ["react", "react-dom", "zustand"],
                i18n:   ["i18next", "react-i18next", "i18next-http-backend"],
                ui:     ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-slider"],
            },
        },
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: true,
    sourcemap: false,
},
```

The interesting choices:

- `target: "es2020"` is the lowest browser version the output has
  to run on. Modern enough to skip transpiling async/await,
  optional chaining, nullish coalescing. The Tauri webviews on all
  shipping platforms support it.
- `minify: "esbuild"` is the fastest path. Terser would shave a
  few more bytes; esbuild is good enough.
- `manualChunks` splits the bundle into a few logical pieces so
  that an app update does not invalidate the user's cache for the
  React or i18n libraries. Browsers cache per chunk hash; only the
  chunks whose content changed need to be redownloaded.
- `sourcemap: false` in production. The cost of shipping source
  maps is download size; the benefit is browser-side debugging,
  which a shipped Tauri app does not expose. Section 03 notes
  that the Rust side ships line tables to Play Console; the React
  side does not have a comparable channel today.

### `__APP_VERSION__`

One small but useful Vite feature is the `define` option:

```ts
define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
},
```

This is a compile-time string substitution. Anywhere the source
writes `__APP_VERSION__`, Vite replaces it with the literal version
string from `package.json` before the file is served or bundled.
The React tree can render the live version number ("Corpán
0.15.10") without ever importing `package.json` at runtime, which
keeps the build output smaller and the runtime simpler. The
adjacent practice in `tauri.conf.json` is that the same version
string is duplicated there manually; the discipline is that bumping
the version touches both files in the same commit.

## Common operations

1. **Run the dev server.** `npm run dev` from
   `corpan/corpan-app/` starts Vite on port 1421. Not normally run
   alone; `npm run tauri dev` runs both the dev server and the
   Tauri binary.
2. **Build for production.** `npm run build` from
   `corpan-app/` runs `tsc --noEmit` first (type check), then
   `vite build`. Output lands in `corpan-app/dist/`, which Tauri's
   release build embeds.
3. **Run a pack's dev server.** `cd corpan/packs/<pack> &&
   npm run dev`. Each pack has its own Vite project on its own
   port (usually 5173 for the default Vite port).
4. **Expose the dev server to a phone on the same LAN.**
   `TAURI_DEV_HOST=192.168.1.x npm run tauri dev` (matching the
   logic at the top of `vite.config.ts`). The Tauri Android build
   uses this to reach the dev server from the device.
5. **Add a path alias.** Add to both `vite.config.ts`
   (`resolve.alias`) and `tsconfig.json` (`paths`). The two are
   independent; both must learn the new name.
6. **Add a Vite plugin.** Install the npm package, import it in
   `vite.config.ts`, add to the `plugins` array. Order matters
   when plugins transform the same files; the array is the
   pipeline.

## Why we built it this way

Vite is the choice that took the latency out of the React edit
loop. The Tauri rebuild cycle for the Rust side is on the order of
seconds even for a one-line change; the React side has to be much
faster than that to be tolerable, and Vite's per-file transform
model makes it so. A typical "edit a component, see the change in
the running app" round trip is well under 250 milliseconds.

The custom `servePacks` plugin is a small illustration of why Vite
fits a project like this. The need (serve local pack files at the
same URL prefix the production site uses) is unusual enough that
no off-the-shelf plugin covers it. The fix is forty lines of
middleware in the same `vite.config.ts` everyone reads anyway. A
Webpack-equivalent of the same feature would have been a separate
loader and a separate plugin and a paragraph in the README; Vite
absorbs it into the configuration.

The production build separating `vendor`, `i18n`, and `ui` chunks
is a small bet on cache stability. An app this size could ship in
one bundle and still load in under a second on a phone; splitting
matters more after the first install, when an update that touched
only a single component does not invalidate the user's cache of
React.

Vite plus `tsc --noEmit` is the two-tool build the CI uses. One
tool checks the types; the other ships the bytes. The split is
documented; it is also the source of one specific friction (path
aliases declared twice), which is small enough that it has not
warranted a third tool to keep them in sync.

## To go deeper

- The Vite documentation at `vite.dev`. The "Features," "Plugins,"
  and "Server Options" pages are concentrated and worth reading
  end to end.
- Evan You's original announcement essay (`vitejs.dev/blog/`)
  explains the native-ESM bet more clearly than any tutorial.
- For the production side, the Rollup documentation at
  `rollupjs.org`. Vite's `build.rollupOptions` is a passthrough;
  most of what Vite does at build time is Rollup with sensible
  defaults.
- esbuild's documentation at `esbuild.github.io` is short and
  worth reading once; it is the unsung half of the dev pipeline.

---

# 09. Styling

> Note for any reader following an earlier outline: this manual's
> original brief said the app uses "no Tailwind, no framework."
> The current code uses Tailwind v4 plus shadcn/ui plus Radix
> primitives plus CSS custom properties. The brief was out of date;
> this section documents what is actually in the tree.

## What it is

The Corpán app's UI is styled with a stack of four cooperating
layers. **Tailwind v4** provides the utility classes (every
`className="flex items-center gap-2"` you read in
`MainExperience.tsx` is Tailwind). **shadcn/ui** provides the
component primitives (the `Button`, `Dialog`, `Drawer`, etc. files
under `src/components/ui/`), copied into the repo as source rather
than imported from a package so they can be edited freely.
**Radix UI** sits under shadcn, providing the accessibility-correct
behavior for popovers, dialogs, sliders, and so on. **CSS custom
properties** (variables) on the `:root` and `.dark` selectors
declare the design tokens (colors, radii) that Tailwind classes
consume by name.

The pack-side aesthetic family is a separate matter. Several packs
(Stargate Reader, Earthgate Reader, Quest-Ear) lean into a
warm-earth-tones / mid-century-science look that is its own visual
vocabulary; that vocabulary lives in those packs' own stylesheets,
not in the host app's design tokens. See section 11 for the pack
anatomy.

## How it fits

Styling is the layer the user actually sees. Every component the
React tree (section 06) renders ends up with classes that resolve
through Tailwind into CSS that the webview paints. The CSS variables
on `:root` are the slot where the design tokens live, so a single
edit at the variable level rolls through every component that uses
the token.

The styling stack also draws the line between the host app and the
packs. Packs ship their own CSS in their `dist/` output and load it
through the pack's `manifest.json` (section 11). The host's design
tokens are not exposed to packs by default; a pack that wants the
same look as the host imports the host's color values directly, or
builds its own.

## Files and entry points

- `corpan/corpan-app/tailwind.config.cjs`: the Tailwind config. Small.
  Contains a `safelist` of opt-in classes (the text-size classes),
  a `breathe` keyframe animation for the speak button's pulsing
  state, and not much else. No theme override beyond the keyframe.
- `corpan/corpan-app/src/index.css`: 322 lines. The single global
  stylesheet. Tailwind v4 directives at the top
  (`@import "tailwindcss"`, `@import "tw-animate-css"`,
  `@custom-variant dark`), all the CSS custom-property
  declarations on `:root` and `.dark`, a small set of
  hand-written rules (`body` font-size, the `.no-scrollbar`
  utility, the `.text-small`/`text-medium`/`text-large`/
  `text-extra-large` opt-in classes), and a careful collection of
  commented-out scaffolding from earlier iterations of the layout.
- `corpan/corpan-app/components.json`: the shadcn/ui config. Names
  the style preset (`"new-york"`), the base color (`"neutral"`),
  the alias prefixes (`@/components`, `@/lib/utils`, etc.), and
  the icon library (`"lucide"`).
- `corpan/corpan-app/src/components/ui/`: the eleven shadcn
  primitives currently imported (`badge.tsx`, `button.tsx`,
  `dialog.tsx`, `drawer.tsx`, `label.tsx`, `popover.tsx`,
  `select.tsx`, `separator.tsx`, `slider.tsx`, `switch.tsx`,
  `tabs.tsx`). These are the only `.tsx` files in the app that
  are explicitly "vendored": they are shadcn's output, edited in
  place when needed.
- `corpan/corpan-app/src/lib/utils.ts`: holds the `cn()` helper
  (a `clsx` + `tailwind-merge` wrapper) that the shadcn components
  use to compose conditional class lists.
- `tauri-plugin-safe-area-insets-css` (in `corpan-app/Cargo.toml`):
  Tauri plugin that exposes `env(safe-area-inset-*)` as CSS custom
  properties so the React layer can pad around the iPhone notch
  and Android display cutout.

## How it works

### Utility classes, briefly

Tailwind's model is that you do not write CSS class names; you
compose them from a fixed vocabulary of utilities, applied directly
in the JSX. So instead of writing:

```css
.meta-chips {
    position: fixed;
    top: 1.75rem;
    left: 1.25rem;
    z-index: 50;
    pointer-events: none;
}
```

…the same intent in `MainExperience.tsx:99` is:

```tsx
<div className="fixed top-7 left-5 z-50 pointer-events-none">
```

Each space-separated token is a Tailwind utility class. `fixed`
applies `position: fixed`; `top-7` is `top: 1.75rem` (Tailwind's
default 4-pixel spacing scale, where `7` is `28px`); `left-5` is
`left: 1.25rem`; `z-50` is `z-index: 50`; `pointer-events-none`
is exactly that. There is no `meta-chips` selector; the styling
lives at the call site.

The argument against this approach is that JSX gets cluttered with
class soup. The argument for it is that the cluttered call site
tells you exactly what the element looks like, and refactoring a
component does not leave an orphaned `.meta-chips` class behind in
a stylesheet nobody reads.

### How Tailwind v4 plugs in

Tailwind v3 ran as a PostCSS plugin and required a long
`tailwind.config.js` that enumerated the design tokens it would
emit. Tailwind v4 reverses the polarity: the design tokens live in
CSS custom properties on `:root`, Tailwind reads them at build
time, and the JavaScript config shrinks to (in this codebase)
keyframes and a safelist. The Vite plugin `@tailwindcss/vite`
(installed in `corpan-app/vite.config.ts:3`) wires it all together;
the developer never thinks about PostCSS.

The CSS in `index.css` opens with the v4 directives:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));
```

`@import "tailwindcss"` brings in the utility classes themselves.
`tw-animate-css` adds an animation utility set on top. The
`@custom-variant` line registers `dark:` as a variant that fires
when any ancestor has the `dark` class; this is how dark mode is
opted into per-tree rather than per-element.

### Design tokens as CSS variables

The middle of `index.css` declares two color systems, one for
light and one for dark:

```css
:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    /* ... and more, including chart and sidebar tokens ... */
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    /* ... a complete mirror set ... */
}
```

A few things to read off this:

- The token names (`--background`, `--foreground`, `--primary`,
  etc.) are exactly the names shadcn/ui's components expect. Pulling
  in a shadcn component "just works" because its `bg-background`
  and `text-foreground` classes look up exactly these variables.
- The values are in **OKLCH**, a perceptually uniform color space.
  `oklch(0.97 0 0)` is "a very light neutral gray." Same-numeric
  changes look like same-visual changes; this is the property RGB
  and HSL famously lack.
- Switching themes is one class change at the root: add `dark` to
  `<html>` and the entire token table flips.

A second block immediately below it maps Tailwind's color slots to
these tokens (`--color-background: var(--background)`, etc.), so
classes like `bg-background` resolve through Tailwind's color
machinery to the OKLCH values.

### shadcn/ui as source, not a dependency

shadcn/ui is not an npm package the app installs. It is a CLI that
copies React component sources into the project's tree. The
`components.json` configuration tells the CLI where to put them
and what style to use; once they are in `src/components/ui/`, they
are part of the codebase. Edits stick.

A shadcn component is two things woven together: a Radix primitive
for behavior, and Tailwind classes wrapped in
`class-variance-authority` (CVA) for variants. The `Button`
component at `src/components/ui/button.tsx:7` is the canonical
example:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all ...",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 ...",
        outline:     "border bg-background shadow-xs hover:bg-accent ...",
        secondary:   "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:       "hover:bg-accent hover:text-accent-foreground ...",
        link:        "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 md:h-11 px-4 py-2 has-[>svg]:px-3",
        sm:      "h-8 md:h-10 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg:      "h-10 md:h-12 rounded-md px-6 has-[>svg]:px-4",
        icon:    "size-9 md:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

Read this top to bottom:

- The first argument to `cva` is the **base classes** every button
  always has.
- The `variants.variant` object enumerates the six shapes a
  button can take. The `default` variant uses the design tokens
  through their Tailwind class names (`bg-primary`,
  `text-primary-foreground`); changing the `--primary` variable
  reshapes the button without touching this file.
- The `variants.size` object uses Tailwind's responsive prefix
  (`md:h-11`) to grow the button on tablet-and-up widths. The
  comment in place documents why: the iPad has the screen real
  estate for a 44pt-friendly tap target (Apple HIG minimum), but
  phones keep the denser sizing so tool palettes stay scannable.
  This is a single source of truth for that decision; it lives
  next to the component, not in a separate "responsive design"
  doc that would rot.
- `VariantProps<typeof buttonVariants>` is a TypeScript type
  (section 07) that extracts the shape of those `variant` and
  `size` keys. Misspelling `<Button variant="default" />` as
  `<Button variant="defualt" />` fails to compile.

### The `cn()` helper

The shadcn components are sprinkled with calls to `cn(...)`:

```tsx
className={cn(buttonVariants({ variant, size, className }))}
```

`cn` is a small wrapper around `clsx` (which merges class names
conditionally) and `tailwind-merge` (which resolves Tailwind
conflicts, so `cn("p-4", "p-2")` becomes `"p-2"` rather than both).
Without `tailwind-merge`, allowing the caller to override padding
on a vendored component would produce both classes and the
visual outcome would depend on rule ordering. With it, the last
one wins, predictably.

### Safe-area insets

The Tauri plugin `tauri-plugin-safe-area-insets-css` exposes the
device's safe-area inset values as CSS custom properties
(`--safe-area-inset-top`, `--safe-area-inset-bottom`, etc.). The
React code reads them via the helpers in `util/browser.ts`
(`getPlatformBottomPadding`, `getPlatformTopPaddingButtons`) and
applies them as inline styles. The commented-out block at the
bottom of `index.css` is an earlier attempt at handling this
purely in CSS by patching `[class~="fixed"][class~="bottom-0"]`
to lift the element by `var(--safe-area-inset-bottom)`. The
current approach moved the logic into JS instead; the commented
CSS is preserved as a record of what was tried.

This is the texture of the layout work in the codebase: there are
a few small in-place comments where commented-out CSS is left as
a paper trail of "we tried this, it didn't quite work, here is the
shape it had." Keep them. They are the cheap version of an ADR.

### The breathe animation

`tailwind.config.cjs` declares one custom animation:

```js
keyframes: {
    breathe: {
        '0%, 100%': {
            transform: 'scale(1)',
            opacity: '1',
            boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.4), 0 4px 6px -4px rgba(168, 85, 247, 0.4)',
        },
        '50%': {
            transform: 'scale(1.05)',
            opacity: '0.95',
            boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.6), 0 4px 6px -4px rgba(168, 85, 247, 0.6)',
        },
    },
},
animation: {
    breathe: 'breathe 2s ease-in-out infinite',
},
```

That animation is the gentle pulse on the speak button while TTS is
playing. The purple is the Corpán accent color (also the pack-chip
purple in `MetaChips`). The `framer-motion` library handles the
larger transitions in the React layer (`useReducedMotion` in
`MainExperience` respects the OS-level preference); these CSS-side
keyframes handle the small ambient loops where a state machine
would be overkill.

## Common operations

1. **Change a design token.** Edit the value in `:root` (and the
   `.dark` counterpart) in `src/index.css`. Every component that
   uses the token through `bg-primary`, `text-foreground`, etc.
   picks up the change on the next dev-server tick.
2. **Add a new shadcn component.** From `corpan/corpan-app/`,
   run the shadcn CLI: `npx shadcn@latest add <component>`. The
   CLI reads `components.json`, fetches the source, and writes
   it into `src/components/ui/`. Commit the new file; the
   component is yours to edit.
3. **Style a new element with Tailwind.** Write the classes
   directly in `className`. Use the design-token classes
   (`bg-background`, `text-foreground`, `border-border`,
   `text-muted-foreground`) when the styling should follow the
   theme; use raw color classes (`bg-purple-500`) when the color
   is fixed and intentional.
4. **Add a variant to a vendored component.** Edit the `variants`
   object in the component's `cva(...)` call. TypeScript's
   `VariantProps` type updates automatically; every call site
   gets the new variant in autocomplete.
5. **Use a class only when a class name is on a parent.** Use the
   `dark:` variant for dark mode (`dark:bg-input/30`), the
   `md:`/`lg:` variants for viewport widths, or define a custom
   variant in `index.css` with `@custom-variant`.
6. **Hide the scrollbar on a scrolling pane.** Add the
   `no-scrollbar` class declared in `index.css`. It targets all
   the scrollbar pseudo-elements across Blink, WebKit, and Gecko.

## Why we built it this way

Tailwind plus shadcn is the combination that gives the small team
the most pixel-accurate output for the least ceremony. Tailwind's
utility classes mean the visual change to "make this card 8 pixels
tighter on the right" happens at the call site without any name-the-
class ritual; shadcn's vendored components mean the visual
adjustments that would normally require contributing back to a
component library happen in our own tree, in the same PR as the
feature that motivated them.

CSS custom properties on `:root` are the token layer that lets the
two cooperate. The shadcn primitives expect the token names; the
Tailwind v4 color machinery reads through them; the dark mode is
one class away. Adding a third theme (the warm-earth-tones aesthetic
the pack family explores) would mean a third selector with a third
set of tokens. The token machinery is built for that.

The pack/host stylistic split is deliberate. Packs are visual
experiments; they want different fonts, different colors, different
densities. Forcing them to inherit the host theme would defeat the
point. The host stays neutral so the packs can be loud, and the
host's tokens are not propagated into packs at all.

The commented-out CSS in the corners of `index.css` is the small
practice that earns the bigger principle: keep the paper trail.
The next time the safe-area-inset story comes up, the person who
opens the file sees that the CSS-only approach was tried and
gives up and finds the JS-based version on the first try.

## To go deeper

- The Tailwind v4 docs at `tailwindcss.com/docs`. Start with
  "Theme" (the v4 CSS-variable model) and "Editor setup" (the
  IntelliSense extension is the single largest productivity
  multiplier in this codebase).
- shadcn/ui's site at `ui.shadcn.com`. The "Components" pages
  show what is available; the "CLI" page documents
  `npx shadcn@latest add ...`.
- Radix UI's primitives at `radix-ui.com/primitives`. Worth
  reading the "Dialog" and "Popover" pages once to understand
  what the shadcn wrappers are wrapping.
- "OKLCH in CSS" at `oklch.com` for an interactive picker. Useful
  the day you have to introduce a new token from a brand color
  and want to keep it perceptually consistent with the existing
  set.

---

# 10. Packs Overview

## What it is

A pack is a small self-contained application that runs **inside** the
Corpán app at runtime. The user installs a pack by URL or by zip; the
host downloads it, stores it on the device, and loads it into a
container element when the user opens it. The pack does its own
rendering, makes its own choices, and uses a small set of host
services for the things only the host can provide: the phrase
corpus, the TTS voice, navigation, optionally a per-pack SQLite
database. Beyond those, the pack is on its own.

The contract between host and pack is the **HostApi**, declared in
TypeScript at `corpan/packs/sdk/index.d.ts` (section 07 walks the
types). The runtime side of the contract is two functions exposed
from the SDK: `registerGame({id, mount})`, called by the pack's
entry script when it loads, and the `mount(container, hostApi)` call
back into the pack when the host is ready to render it.

There are eleven packs in `corpan/packs/` on `main` at the time of
writing (section 01 enumerates them). Each is a separate npm
package with its own Vite build and its own `CHANGELOG.md`. The
packs share no runtime; the only thing two packs have in common is
that they speak the same HostApi.

## How it fits

Packs are the unit of velocity. Most new features in Corpán ship as
packs, not as edits to the host app. A new reading experience, a new
listening game, a new pronunciation drill, a new musical
exploration: each begins as a pack, gets shipped as a pack, and
graduates into the host only if the same shape proves useful to many
other packs.

The architectural payoff is that the host stays small. The Corpán
binary on every platform (iOS, Android, desktop) contains a fixed
runtime: corpus access, TTS, STT, IAP, navigation. Adding a new
*game* does not bump the binary. Adding a new *pack* does not require
an App Store or Play Store review.

The boundary between host and pack is the seam where every
architectural choice in Part III takes its shape:

- The pack's view of the host is the `HostApi` interface (section 12).
- The pack ships its own visual identity (section 11 anatomy, plus
  section 09's note that packs do not inherit host styling).
- Packs that compose into a larger catalog (Earthgate Reader,
  Stargate Reader, Quest-Ear) share the `corpan/packs/shared/` tree
  for common surfaces (section 13).
- Shared state across packs uses a small set of stores
  (`bookMetaStore`, etc.) so a phrase the user heard in one place
  shows up correctly in another (section 14).
- Audio playback surfaces into a global transport bar (section 15).

## Files and entry points

- `corpan/packs/sdk/`: the SDK. `index.d.ts` is the type
  declarations; `index.js` is the 141-line runtime
  (`registerGame`, `createMockHostApi`, `mountStandalone`);
  `README.md` is the contract-as-prose explanation;
  `package.json` is the npm package.
- `corpan/packs/shared/`: the cross-pack library. Subtrees for
  `core/`, `sdk/`, `audio/`, `ui/`, `catalog/`, `state/`, `data/`.
  Imported by the packs that need any of it; not depended on by
  the host.
- `corpan/packs/<pack>/`: each pack lives in its own directory
  alongside the others. As of `main`: `earthgate-reader`,
  `hanzipan`, `hover-runner`, `juice-squeeze`,
  `pronunciation-coach`, `pronunciation-coach-0.3.5` (pinned
  snapshot), `quest-ear`, `stargate-reader`, `world-radio`,
  `world-radio-legacy`. The shape is consistent: `package.json`,
  `vite.config.ts`, `tsconfig.json`, `manifest.json`,
  `index.html`, `src/`, `dist/`, `CHANGELOG.md`, often an
  `<avatar>.png`.
- `corpan/packs/README.md`: documents the two-phase rollout (the
  manifest-install flow shipped now, the IAP store-purchase flow
  shipped next). Brief; worth reading once.
- `corpan/corpan-app/src-tauri/src/content_packs.rs`: the Rust
  host's implementation of pack install, download, extract, and
  serve via the `corpan-pack://` URL scheme. The mirror image of
  the SDK on the host side.
- `corpan/corpan-app/src/contentPacks/`: the React host's
  pack-loading bridge. Owns the `<iframe>` or container element
  the pack mounts into and brokers calls from the pack's
  `hostApi` to the underlying Tauri commands.

## How it works

### The contract, in one paragraph

A pack ships a `manifest.json` with an `id`, a `name`, a `version`,
an `entry` script path, optional `styles`, and optionally a
`databases` map. The host loads the entry script. The script's
top-level code calls `registerGame({ id, mount })`, which stores the
pack on `window.CorpanGames[id]`. The host then calls the stored
`mount(container, hostApi, initialState)` to render the pack into a
container element. The pack uses `hostApi` for any host services it
needs and returns an optional `{ unmount }` object that the host
calls when the user navigates away.

That is the entire runtime model. Everything else is a refinement.

### The SDK runtime

The whole pack-side runtime is 141 lines in
`corpan/packs/sdk/index.js`. Three exported functions and one
private helper:

- `registerGame(game)`: validates that `game.id` is a string and
  `game.mount` is a function; writes the game to a global registry
  at `window.CorpanGames`. Returns the same game for chaining.
- `createMockHostApi(options)`: returns a `HostApi` implementation
  that uses the browser's `SpeechSynthesisUtterance` for `speak`,
  returns fixed sample entries for `getRandomEntry` etc., and lets
  the caller override any field. Used during browser-only
  development.
- `mountStandalone(game, options)`: creates a fixed-position div in
  `<body>`, calls `game.mount(container, hostApi, initialState)`,
  and returns an `unmount` closure that the developer can call to
  tear down. Used by `index.html` in each pack so `npm run dev`
  works without the host app.

The minimalism is the point. The pack-side runtime that ships in
the bundle is tiny; the heavy lifting lives on the host side, and
the pack reaches it through the contract.

### The manifest

The manifest is the pack's name tag, version stamp, and load
instructions. Earthgate Reader's `manifest.json` is the canonical
example:

```jsonc
{
  "id": "earthgate_reader",
  "name": "Earthgate Reader",
  "version": "0.6.6",
  "description": "Calm, earth-toned audiobook reader with word-level highlighting synced to narrated audio",
  "entry": "dist/app.js",
  "styles": ["dist/app.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0",
  "devRevision": "2026-05-19T07:21:56.439Z",
  "nameLocalized": { "ar": "...", "bg": "...", /* 50+ locales */ },
  "descriptionLocalized": { /* same locale set */ }
}
```

The fields divide roughly into three groups:

- **Identity**: `id`, `name`, `version`, `description`. The `id` is
  the durable handle the host uses for storage paths and history
  joins; `version` is the SemVer that drives the changelog and
  cache-busting; `name` and `description` are the user-facing
  labels.
- **Load**: `entry`, `styles`, `entryType`, `sdkVersion`,
  `devRevision`. The `entry` is the JS file the host loads first;
  `styles` is loaded into the container as `<link>` tags;
  `entryType: "script"` means it is a classic script (not an ES
  module), which is the lowest-common-denominator that every
  webview understands; `devRevision` is an ISO timestamp the host
  uses to bust the dev cache without bumping the version.
- **Localization**: `nameLocalized` and `descriptionLocalized` are
  per-locale maps the catalog UI uses to display the pack in the
  user's chosen language. Section 13 covers how the resolver picks
  the right entry; section 09 covers the pack-vs-host visual
  split.

### The two install modes

Packs ship two ways, both produced by the same build (section 02):

- **Manifest install**: the host fetches the manifest URL, then the
  `entry` and `styles` URLs, all over HTTPS. The pack runs the
  same way it would in any browser. Updates are always-on; closing
  and re-opening the pack picks up any changes the developer just
  pushed.
- **Zip install**: the host downloads a single `<pack>.zip` that
  contains `manifest.json` and `dist/`, extracts it into the
  device's app data directory under `corpan-packs/<id>/`, and
  serves the files locally through a custom `corpan-pack://` URL
  scheme registered by `tauri-plugin-game-packs`. Updates are
  manual: the user reinstalls.

The two modes coexist on every pack's landing page. The dev-mode
unlock (Settings → tap "Corpán" seven times) reveals the manifest-
URL input field; in production it stays hidden but the same
machinery is alive underneath, ready for the IAP flow (phase 2 in
`packs/README.md`).

### The loop

End to end, the install + run path for a pack looks like:

```
[Pack lands on encorpora.io via build pipeline (section 02)]
                 |
[User opens Corpán app, dev unlock or IAP triggers an install]
                 |
[Rust host (content_packs.rs) downloads manifest, downloads zip
 if applicable, extracts to {app_data_dir}/corpan-packs/<id>/]
                 |
[React host (src/contentPacks/) creates a container element]
                 |
[Host loads dist/app.js (and its CSS) into the container's frame
 either via http(s):// (manifest install) or via
 corpan-pack://localhost/<id>/dist/app.js (zip install)]
                 |
[Pack's top-level code runs: registerGame({id, mount})]
                 |
[Host reads window.CorpanGames[<id>], calls
 game.mount(container, hostApi, initialState)]
                 |
[Pack renders, calls hostApi.getRandomEntry(), hostApi.speak(...),
 etc.; user uses the pack]
                 |
[User navigates away; host calls instance.unmount() if returned]
```

Every step in this loop is small. The longest single file is
`content_packs.rs` at 503 lines, and it covers all of the
zip-extraction, custom-protocol-serving, and integrity-checking
behavior the host does for every pack ever installed.

## Common operations

1. **Create a new pack.** Copy `corpan/packs/sdk/` (or an existing
   pack as a richer starting point), edit `manifest.json` with a
   new `id`, `name`, and `version`. Implement
   `registerGame({ id, mount })` in `src/main.ts` (or equivalent).
   `npm run dev` to test with `mountStandalone`. Add to
   `web/pages/data/packs.json`. Add build/copy steps to
   `package.json` and `.github/workflows/hover-runner-pages.yml`
   (section 02 has the recipe).
2. **Install a pack in development.** Open Corpán dev build,
   Settings, tap "Corpán" seven times to reveal the Packs panel.
   Paste a manifest URL (e.g.
   `http://192.168.1.x:5173/manifest.json` for a local Vite dev
   server) and tap Install. Hot reload works through the host on
   manifest changes.
3. **Test a pack in the browser.** From the pack directory,
   `npm run dev`. The pack's `index.html` calls
   `mountStandalone(game)` and the SDK's mock host returns sample
   data. No Corpán app needed.
4. **Package a pack for offline install.** From the pack
   directory, `npm run pack` (where the pack has a
   `scripts/pack.mjs`; see Earthgate Reader for the reference) or
   from the repo root, `npm run package:<pack>` (which is the
   shape baked into the root `package.json` for the reference
   packs).
5. **Read a pack's history.** Open its `CHANGELOG.md`. Every
   change to a versioned pack lands an entry in `[Unreleased]`;
   every version bump promotes the entry to a dated heading. The
   doctrine is in `corpan/CHANGELOGS.md` (section 02).
6. **Audit what packs are installed.** Inside Settings → Packs in
   the app, or by inspecting
   `{app_data_dir}/corpan-packs/` on the device's filesystem.
   The host exposes a `content_packs_list_installed` Tauri command
   (section 04) that returns the same list.

## Why we built it this way

Packs are the architectural bet the project is most invested in.
The host's job is to make the pack feel like a part of the app; the
pack's job is to be the part of the app that gets to be loud. The
small contract is what makes both possible. If the contract were
fat, every pack would constrain the host's evolution; if the
contract were absent, every pack would invent its own way to ask
for an entry from the corpus. The seven `HostApi` methods (one of
them itself a nested `stt` API, three of them optional) are the
small surface area we have settled on after several years of
trying both ends of the spectrum.

The SDK is small for the same reason. The runtime is 141 lines
because everything heavier lives somewhere worth owning: in the
shared library under `corpan/packs/shared/` for code that some
packs reuse, in the Rust host for behavior that has to be one
implementation per device, in the pack itself for behavior that
should never escape into a generic library.

The manifest is the smallest declaration that makes "what is this
thing?" answerable without running the code. An id, a version, a
script, a style sheet, two maps of localized strings. That is
enough for the host to install, list, route, render, and label
a pack. Adding more fields is a deliberate decision each time, and
the discipline so far has been to add few of them.

The two install modes (manifest and zip) are the smallest
agreement that handles both "I am on Wi-Fi and I want this to
update on its own" and "I am on a plane and I need this to work."
Both modes use the same underlying flow; the difference is only
where the pack files live and how the URL prefix resolves. The
custom `corpan-pack://` protocol is the elegant way to make those
two cases indistinguishable to the pack's own code.

The non-coupling between host visual identity and pack visual
identity is the other piece of the architectural bet. The host is
neutral so a pack can be Stargate Reader and another can be
Hover Runner without either looking out of place inside an app
called Corpán. Section 09 closes that loop.

## To go deeper

- `corpan/packs/sdk/README.md` for the prose summary of the
  contract.
- `corpan/packs/README.md` for the two-phase rollout map.
- `corpan/corpan-app/src-tauri/src/content_packs.rs` for the
  host-side install path. Worth reading once; 503 lines is shorter
  than it sounds.
- `GAME_INSTALL_SUMMARY.md` at the repo root for the
  manifest-vs-zip comparison from the user's perspective.
- Section 11 for the anatomy of a pack as a project on disk;
  section 12 for the HostApi in detail.

---

# 11. Pack Anatomy

## What it is

A pack on disk is a small npm project with a fixed shape: a
`package.json` and a `vite.config.ts` for the build, a
`tsconfig.json` for the type-check, a `manifest.json` for the host,
an `index.html` for standalone browser development, a `src/` tree
for the source, an optional `scripts/` directory for packaging, and
a `dist/` directory the build produces. Eleven packs on `main` all
follow this shape; reading one teaches you how to read the others.

This section walks Earthgate Reader (`corpan/packs/earthgate-reader/`)
end to end. It is a representative "catalog pack": a reader that
composes the shared catalog shell (sections 13 and 15) with its own
visual identity and its own paragraph view, and ships as **code
only** (no bundled audio; narration is served from CloudFront and
downloaded by the app on demand).

## How it fits

The pack anatomy is the file-system surface of the contract section
10 introduced. The host treats `manifest.json` and `dist/` as the
two things it must see; everything else exists for the developer's
sake. `manifest.json` is what gets uploaded to encorpora.io and
embedded in the zip. `dist/` is the build output the host loads at
runtime. The rest of the directory is the project that produces
those two artifacts.

The anatomy is also the boundary the changelog discipline (section
02) rests on. Each pack has a `CHANGELOG.md` next to its
`manifest.json`. Bumping the version in the manifest promotes
`[Unreleased]` to a dated entry. Section 36 will turn that prose
into a system-wide history.

## Files and entry points

The reference layout, with Earthgate Reader's specifics noted in
parentheses:

```
corpan/packs/<pack>/
├── manifest.json         Identity, version, entry, styles, localized names
├── package.json          Vite, TypeScript, zustand; scripts for build/pack
├── vite.config.ts        Build config; declares __<PACK>_VERSION__ via define()
├── tsconfig.json         Strict TS config; pulls in @shared via path alias
├── index.html            Standalone dev entry; calls mountStandalone(game)
├── CHANGELOG.md          Keep a Changelog, version-locked to manifest.json
├── corpan-logo.png       The Corpán mark, embedded in the dist for offline use
├── <pack>-avatar.png     The pack's avatar, the image the catalog displays
├── src/
│   ├── main.ts           The entry; calls registerGame({id, mount}) at top level
│   ├── game.ts           The pack's actual experience
│   ├── styles.css        The pack's local CSS, imported by main.ts
│   ├── vite-env.d.ts     Ambient typings for Vite's import.meta.env
│   ├── i18n/             Per-locale metadata JSON (Earthgate has metadata.en.json)
│   └── rendering/        Pack-specific subtrees (Earthgate has paragraphView.ts)
├── scripts/
│   ├── dev-corpan.mjs    Dev helper: bump devRevision so the host re-fetches
│   └── pack.mjs          Build the zip from manifest.json + dist/
└── dist/                 The build output; not in git. App.js + app.css.
```

The catalog packs (Earthgate Reader, Stargate Reader, Quest-Ear,
Pronunciation Coach) all import heavily from `corpan/packs/shared/`,
particularly:

- `@shared/sdk`: types (`GameModule`, `HostApi`, `EntryOut`),
  `createMockHostApi`. Catalog packs import these instead of
  `@corpan/sdk` because the shared sdk is a superset.
- `@shared/catalog`: the catalog shell (`createAppShell`,
  `ReaderFactory`). Wraps the reader in a consistent chrome.
- `@shared/audio`: the audio engine, media session integration,
  native keepalive (section 15).
- `@shared/ui`: cross-pack UI primitives (`transportBar`,
  `chapterOverlay`, `commandDrawer`, `narrationSwitcher`).
- `@shared/state`: shared Zustand stores (`bookMetaStore`,
  `bookmarkStore`, `narrationHistoryStore`). See section 14.
- `@shared/data`: data providers (`bookCatalog`, `dataProvider`,
  `packFetch`, `segmentLoader`).
- `@shared/core`: pure types and pure functions (`buildTimeline`,
  `findCurrentWordIndex`, `buildChapterIndex`).
- `@shared/analytics`: a thin wrapper.

Smaller packs (Hover Runner, Hanzipan) skip most of `shared/` and
implement their own UI directly, because their experiences do not
fit the catalog mold.

## How it works

### The build, end to end

`npm run build` runs `vite build` against the pack's `vite.config.ts`
and produces `dist/app.js` (the bundled pack code, classic script
form) and `dist/app.css` (the bundled styles). The build:

- Resolves `@shared/...` imports through the pack's path alias to
  the same `corpan/packs/shared/` source tree the host's TypeScript
  also sees.
- Substitutes `__EARTHGATE_READER_VERSION__` (defined in
  `vite.config.ts`) with the version string from `package.json`.
- Targets `es2020` (the same target the host uses), so the
  output runs on every shipping webview.
- Inlines small assets (the avatar PNG, the logo) so that the
  offline-zip install does not have to ship loose files alongside
  the entry script.

The output is two files. That is the entire build.

### The entry script

Every pack's runtime starts when the host evaluates the entry. The
top of Earthgate Reader's `src/main.ts` shows the pattern:

```ts
import "./styles.css"
import type { GameModule, HostApi } from "@shared/sdk"
import { createEarthgateReader } from "./game"
import { createAppShell, type ReaderFactory } from "@shared/catalog"

declare const __EARTHGATE_READER_VERSION__: string

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __earthgateReader?: { dispose: () => void }
}

const GAME_ID = "earthgate_reader"

const readerFactory: ReaderFactory = (container, hostApi, initialState) => {
  return createEarthgateReader(container, hostApi as HostApi, initialState)
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      // ... read baseUrl/contentRevision from host-injected script tag ...
      const shell = createAppShell(container, {
        readerId: "earthgate",
        readerVersion: __EARTHGATE_READER_VERSION__,
        createReader: readerFactory,
        hostApi,
        // ...
      })
      return shell
    },
  }
}

registerGame()
```

Six observations:

1. The pack imports its own CSS (`import "./styles.css"`). Vite
   processes the import and the resulting CSS lands in
   `dist/app.css`, which the host's manifest references in its
   `styles` array.
2. The version string is declared as an ambient global
   (`declare const __EARTHGATE_READER_VERSION__: string`) and the
   Vite `define` option substitutes the literal string at build
   time. The comment in the file explains why the manifest is
   **not** imported directly: the dev-corpan helper script mutates
   `manifest.json` (bumping `devRevision`) to bust the host's cache,
   and importing the manifest would put it in Vite's watch graph
   and trigger an infinite rebuild loop.
3. The `GAME_ID` (`"earthgate_reader"`) is the same string as the
   manifest's `id`. The host uses this string everywhere: in the
   download path, in the `corpan-pack://` URL, in the
   `CorpanGames` registry key. The pack and the host agree by
   convention; no codegen.
4. `registerGame()` is the pack's own function with the same name
   as the SDK's, defined inline. It does the same job
   (write a game module onto `window.CorpanGames`) but does it
   directly. Reader packs that pull from `@shared/catalog` write
   their own because the SDK's helper is too lean for their needs.
5. The `mount` callback reads two data attributes off the host-
   injected `<script>` tag: `data-corp-game-base-url` and
   `data-corp-game-content-revision`. The host sets these so the
   pack can fetch its content from the right URL (manifest install
   uses the encorpora.io origin; zip install uses
   `corpan-pack://localhost/<id>/`) without the pack having to
   guess. This is the small handshake that makes the two install
   modes invisible to the pack code.
6. The actual experience is built in `createAppShell(...)`, which
   is shared (section 13), and `createEarthgateReader(...)`, which
   is pack-specific (`src/game.ts`). The split between "the
   catalog chrome around any reader" and "the reader itself" is
   the structural reason `@shared/catalog` exists.

### The standalone dev entry

`index.html` at the pack root is what `npm run dev` serves. It is
roughly:

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/src/styles.css">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
    <script type="module">
      import { mountStandalone } from "@shared/sdk"
      const game = window.CorpanGames["earthgate_reader"]
      mountStandalone(game, { container: document.getElementById("root") })
    </script>
  </body>
</html>
```

(Each pack varies the exact bootstrapping; the essence is the same.)
`main.ts` registers the game on `window.CorpanGames`; the inline
module then reaches into the registry and mounts the game with a
mock host (`mountStandalone` uses `createMockHostApi` by default,
section 10). The result: open `http://localhost:5173/` and you are
running the pack against a fake corpus and the browser's
`SpeechSynthesisUtterance` for TTS, with no Corpán app in the loop.

### Code-only vs. data-bundled packs

The `pack.mjs` script under `scripts/` describes how the zip is
built. Earthgate's is forty lines:

```js
// 1. Verify dist/app.js exists.
// 2. Clean any legacy data/ dir.
// 3. Remove the previous zip.
// 4. zip -r earthgate-reader.zip manifest.json dist/
```

That is the entire packaging story for a **reader pack**: ship
the manifest and the build output, nothing else. Narration audio
lives on CloudFront (S3 + CloudFront; sections 24 and 25) and is
fetched per-segment by the host's content_packs side at runtime.
The zip is small (single-digit MB) and the same zip serves every
book the reader can open.

Data-bundled packs are the exception. Hanzipan's `package:hanzipan`
script in the root `package.json` (section 02) shows the variation:
it concatenates a vendored JS library (`hanziwriter.min.js`) into
the build, ships a `data/` directory of Han character writing
descriptions, and bundles a LICENSE file. The zip is larger and
self-contained.

This is the line packs draw between "we are a renderer over the
host's content" and "we are an experience with its own content."
Both are valid; the manifest's `databases` map (the optional one)
formalizes the "we ship our own SQLite alongside our code" case
that Hanzipan exemplifies.

### The dev-corpan helper

`scripts/dev-corpan.mjs` is the second script reader packs ship. It
bumps `manifest.json`'s `devRevision` field to a fresh ISO timestamp
on every run, so the host's cache (which keyed off
`(id, version)` plus `devRevision`) invalidates and pulls a fresh
copy. This is how a developer hits "save" in their editor and sees
the change in the Corpán app a moment later without having to
reinstall the pack.

The comment in `main.ts` about not importing `manifest.json`
directly exists because of this helper. The two interact: the
manifest is the canonical version source, but the dev-corpan
helper rewrites it on each tick, and importing it into the
JS-side graph would feed the watcher its own output.

### `package.json` and `vite.config.ts`

`package.json` declares the seven scripts a pack typically ships:

```json
{
  "scripts": {
    "dev":         "vite",
    "dev:corpan":  "node scripts/dev-corpan.mjs",
    "dev:watch":   "vite build --watch",
    "build":       "vite build",
    "typecheck":   "tsc --noEmit",
    "preview":     "vite preview",
    "pack":        "node scripts/pack.mjs",
    "pack:all":    "npm run build && node scripts/pack.mjs"
  }
}
```

`dev:watch` is what the root orchestrator (`npm run dev` from the
repo root) uses to keep the composed Pages site up to date as the
pack changes. `pack:all` is the full release-build sequence. The
two `tsc` and `vite build` separation mirrors the app side
(section 08): one tool for types, one tool for bytes.

`vite.config.ts` for a pack is similar shape to the app's but
narrower. It defines:

- The library-build target (the pack ships as a classic script,
  not as ES modules with import statements).
- The `define` substitutions (the version string).
- The `resolve.alias` map (`@/` for the pack's `src/`,
  `@shared/` for `corpan/packs/shared/`).
- Output filenames (`app.js`, `app.css`).
- Possibly inline-asset thresholds (so small PNGs end up in the
  bundle instead of loose).

The pack's bundle is a self-contained script; the host evaluates
it once and the pack is alive.

## Common operations

1. **Walk a pack you have never seen.** Open
   `corpan/packs/<pack>/manifest.json`, then `src/main.ts`, then
   the function `main.ts` calls (`createAppShell` for catalog packs,
   the pack's own `mount` body otherwise), then `src/game.ts` if
   it exists. That is the spine.
2. **Make a code edit and see it in the app.** From the pack
   directory: `npm run dev:watch` to rebuild on change. From the
   app: install the pack by its manifest URL once. Re-open the
   pack; the host's cache is invalidated by `devRevision` and a
   fresh build is loaded.
3. **Add a shared module.** Drop a new file under
   `corpan/packs/shared/<area>/`. Re-export from
   `corpan/packs/shared/<area>/index.ts`. Import as
   `@shared/<area>` from any pack.
4. **Bump a pack's version.** Edit `manifest.json` `version` and
   `package.json` `version` to the same number. Promote
   `[Unreleased]` in `CHANGELOG.md` to `[X.Y.Z] - YYYY-MM-DD` and
   add a fresh `[Unreleased]` above it. Commit, push, PR.
5. **Package for offline install.**
   `npm run pack:all` from the pack directory produces
   `<pack>.zip`. The root `package.json` has a matching
   `package:<pack>` script for the reference packs that the root
   build orchestrator calls.
6. **Type-check only.**
   `npm run typecheck` from the pack directory runs `tsc --noEmit`
   against the pack's tsconfig. Catches breaks before a full Vite
   build runs.

## Why we built it this way

The shape is consistent because the cost of variation would be paid
forever. Once a pack diverges in build, packaging, or entry
conventions, every later pack has to choose between matching the
divergence or starting fresh. Keeping the shape uniform means a new
contributor reads one pack and understands ten others, and the
root `package.json` can drive every pack with the same three
verbs (`build`, `package`, `copy`).

The `__<PACK>_VERSION__` define and the deliberate non-import of
`manifest.json` are a small example of the kind of detail that
earns its place. Either could have been done another way; both
choices avoid a specific dev-loop failure mode (the infinite
rebuild). Once that lesson is learned, codifying it in the
template is cheap.

The split between `@shared/catalog` and the per-pack reader is the
architectural payoff for catalog-style packs. The chrome (transport
bar, narration switcher, command drawer, settings rows) is the
same across Earthgate, Stargate, and Quest-Ear because they are
all reading experiences over the same underlying audio/text model.
The chrome is the shared library; the experience is the per-pack
reader. Adding a new reader is a `createAppShell({ readerId,
createReader })` call plus the renderer implementation.

Code-only reader packs are a deliberate scale choice. A book like
Three Questions is 23 languages, hundreds of segments per language,
LUFS-mastered audio at 16 bits and 24 kHz. Shipping that in every
reader pack zip would push the zips into the hundreds of megabytes;
serving the same audio from CloudFront and bundling only the
renderer keeps the install lean and the cache CDN-warm. Hanzipan
is the controlled exception: its data is small enough and tightly
enough bound to the renderer that bundling makes sense.

The standalone `index.html` plus `mountStandalone(game)` plus
`createMockHostApi()` is the dev-time discipline that keeps packs
honest. A pack that only works inside the Corpán app cannot be
unit-tested in a browser tab; a pack that works in a browser tab
against a mock host has documented exactly which `HostApi` methods
it uses, because the mock will tell you when it does not.

## To go deeper

- `corpan/packs/earthgate-reader/src/main.ts` for the cleanest
  reading of the entry-script shape.
- `corpan/packs/earthgate-reader/src/game.ts` for what an actual
  reader implementation looks like end to end (imports from every
  `@shared/*` subtree; the comment at the top names the design).
- `corpan/packs/hanzipan/manifest.json` for the data-bundled
  manifest shape (the `databases` map populated).
- `corpan/packs/sdk/README.md` for the contract again, this time
  against the typeset of the SDK as it exists in the npm package.
- Section 12 for the HostApi in detail; section 13 for the
  catalog shell `createAppShell` orchestrates here; section 14 for
  the shared state stores `game.ts` imports; section 15 for the
  transport bar `@shared/ui` exposes.

---

# 12. Pack Host API

## What it is

The Host API is the runtime object the host hands to a pack when it
calls `mount(container, hostApi, initialState)`. It is the entire
surface the pack uses to reach corpus, TTS, STT, navigation, and
any per-pack SQLite database. Anything not on this object is
unreachable from the pack: there is no `import` that crosses from
pack code into the Corpán app's React tree, there is no `window`
backdoor (in production), there is no shared Zustand store the
pack can subscribe to without going through this object.

The contract is declared as a TypeScript type. The pack imports it
from the SDK; the host implements it; the two never share a runtime
module. This separation is the whole point: a pack can be loaded
from a URL the host has never seen before and the only thing both
sides need to agree on is the shape of one object.

## How it fits

The Host API sits between three other systems and acts as the
single seam:

- Below it, in Rust: the Tauri commands the React host exposes
  (section 04). Every `getRandomEntry` call eventually translates
  into an `invoke("get_random_entry_with_translations", ...)`. Every
  `speak` call eventually routes through `tauri-plugin-tts`. Every
  `stt.startSession` call lands in `tauri-plugin-stt`.
- Above it, in the pack: the application code that uses the corpus
  to render a reading experience, a game, a drill, a song
  exploration. The pack never sees a Tauri concept; it sees only
  methods on the HostApi.
- In parallel: the **mock** HostApi the SDK exports for browser-
  only development. The same type, a different implementation
  that uses `SpeechSynthesisUtterance` and returns sample data.
  The pack does not know which one it is talking to.

When the contract changes, three files change in lockstep: the
TypeScript declaration the pack reads, the host implementation that
returns it, and the mock that simulates it.

## Files and entry points

### Pack-side (the contract)

- `corpan/packs/sdk/index.d.ts`: the canonical pack contract. 223
  lines of type declarations. Has the full `HostApi` (with the
  `SttApi` sub-shape) plus the `GameModule`,
  `ContentPackManifest`, `StackConfig`, and `EntryOut` types
  packs share with the host.
- `corpan/packs/sdk/index.js`: the SDK runtime including
  `createMockHostApi()` (the prototype mock).
- `corpan/packs/shared/sdk/types.ts`: a narrower `HostApi` used by
  catalog packs (Earthgate, Stargate, Quest-Ear). Same shape as
  the SDK's but trimmed to what those packs actually use.
- `corpan/packs/shared/sdk/mockHostApi.ts`: the mock for the
  shared SDK. 30 lines; logs every call to the console.
- `corpan/packs/shared/sdk/index.ts`: re-exports.

### Host-side (the implementation)

- `corpan/corpan-app/src/contentPacks/hostApi.ts`: the production
  HostApi the host instantiates per loaded pack. 459 lines. Each
  method either reads from a Zustand store, invokes a Tauri
  command, or both.
- `corpan/corpan-app/src/contentPacks/types.ts`: the host's copy
  of the contract types. Mirrors the SDK's `index.d.ts`.
- `corpan/corpan-app/src/contentPacks/ContentPackHost.tsx`: the
  React component that mounts a pack. It is the one that calls
  `mount(container, hostApi, initialState)` and stashes the
  optional `{ unmount }` return value for later.
- `corpan/corpan-app/src/contentPacks/install.ts`,
  `installProgress.ts`, `purchase.ts`,
  `phrasePackRegister.ts`: surrounding machinery (download,
  install, purchase, register) that fills in the host side of the
  pack lifecycle.

## How it works

### The contract, field by field

Reading the SDK's `HostApi` declaration top to bottom
(`corpan/packs/sdk/index.d.ts:159`):

```ts
export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById: (entryId: number, source?: string) => Promise<EntryOut>
  searchEntriesByText?: (options: {
    text: string
    languageCodes?: string[]
    limit?: number
    offset?: number
  }) => Promise<EntryOut[]>
  searchEntriesByTextCount?: (options: {
    text: string
    languageCodes?: string[]
  }) => Promise<number>
  queryPackDb?: (query: PackDbQuery) => Promise<PackDbQueryResult>
  stt?: SttApi
  isMock?: boolean
}
```

Eleven methods, three categories.

**Speech**:

- `speak(uiCode, text)`: ask the host to say `text` in the voice
  appropriate for `uiCode`. `uiCode` is a BCP-47 language tag (`"es"`,
  `"ko-polite"`, etc.) the host resolves to one of the user's
  configured voices for that language. Returns when speech queueing
  succeeds, not when speech finishes (there is no completion event
  in the contract; packs that want one wire it through `stt` or
  through their own timing model).

**Stack and corpus**:

- `getStackConfig()`: synchronous, returns the current user
  preferences (`activeStackId`, `languages`, `levels`, `rate`,
  `textSize`, `showRomanization`, etc.). The pack reads it once on
  mount and stores any derived state it needs.
- `onStackConfigChange(listener)`: subscribe to changes. The
  returned function is the unsubscribe. Standard "subscribe once,
  unsubscribe on unmount" lifetime.
- `getRandomEntry()`: returns one `EntryOut` shaped like the
  one section 04 walked through.
- `getRandomEntries?(count)`: optional batch variant. Packs that
  display a list ask for several at once; packs that step
  one-at-a-time use the singular form.
- `getEntryById(entryId, source?)`: looks up a specific entry. The
  optional `source` is the phrase-pack id (`"base"` for the
  bundled corpus, or a phrase-pack id when the entry came from a
  pack). Packs that store entries in history need to remember the
  `(source, entryId)` pair; `entryId` is unique only within a
  source.
- `searchEntriesByText?(options)`, `searchEntriesByTextCount?`:
  optional full-text search across the corpus translations.

**Per-pack data and platform**:

- `queryPackDb?(query)`: run a read-only SQL query against the
  pack's bundled SQLite database. Hanzipan uses this for the
  Han-character data it ships; reader packs do not.
- `stt?`: the optional STT sub-API. A separate object because
  pronunciation-coach packs use a dozen methods that no other pack
  needs, and putting them on the top-level shape would clutter the
  contract for every other pack.
- `isMock?`: `true` on the mock host, absent on the production
  one. Packs can branch on it for debugging; production code
  should not depend on the difference.

### Why "the smaller shared SDK"

`corpan/packs/shared/sdk/types.ts` declares a narrower `HostApi`:

```ts
// corpan/packs/shared/sdk/types.ts:24
export type HostApi = {
  speak: (lang: string, text: string) => void
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void
  getRandomEntry?: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById?: (entryId: number) => Promise<EntryOut>
  isMock?: boolean
}
```

Two patterns to notice:

1. **`speak` returns `void` here**, not `Promise<void>`. Reader
   packs do not wait on speech; they kick it off and move on. The
   narrower contract makes that explicit.
2. **Almost everything is optional.** Catalog packs use `speak`
   and `getStackConfig` heavily; many do not use `getRandomEntry`
   at all because their content comes from the book corpus
   (downloaded segments), not from the phrase corpus. Marking the
   methods optional documents which ones a given pack actually
   needs.

This is the codebase's working position on the contract: the SDK's
type is the maximal one; the shared/sdk type is the minimal
catalog-pack one; both are honest about what their consumers do.

### The host implementation

`corpan/corpan-app/src/contentPacks/hostApi.ts` builds a fresh
`HostApi` object per pack instance, closing over the necessary host
state. The skeleton looks like:

```ts
export function createHostApi(packId: string): HostApi {
  return {
    speak: async (uiCode, text) => {
      return speakWithStackPrefs(uiCode, text)
    },
    getStackConfig: () => getStackSnapshot(),
    onStackConfigChange: (listener) => {
      // subscribe to the settings store; convert store changes to
      // listener calls; return unsubscribe
    },
    getRandomEntry: async () => {
      return invoke<EntryOut>("get_random_entry_with_translations", {
        // pull current filters from the settings store
      })
    },
    getEntryById: async (entryId, source = "base") => {
      return invoke<EntryOut>("get_entry_by_id_with_translations", {
        entryId,
        source,
      })
    },
    queryPackDb: async (query) => {
      return invoke<PackDbQueryResult>("content_packs_query_db", {
        ...query,
        packId,
      })
    },
    stt: makeSttApi(packId),
  }
}
```

(That is a simplified shape; the actual file is 459 lines because
each method has the edge cases the corresponding Tauri command
expects.)

Three patterns repeat:

- **Read from a store, never accept inline params.** The pack does
  not pass filters to `getRandomEntry`; the host reads the current
  filter state from the settings store and includes it in the
  IPC call. This keeps the contract tight (one zero-arg method)
  and the source of truth (the settings store) singular.
- **Translate at the seam, not above.** The pack does not see Tauri
  command names; the host translates `getRandomEntry()` into
  `invoke("get_random_entry_with_translations", ...)`. Renaming
  the Rust command does not require touching every pack.
- **Errors are surfaced as rejected promises.** The
  `sttRejectionToError` helper at the top of `hostApi.ts`
  illustrates: Swift encodes errors as `"CODE: human message"`,
  and the host parses the prefix into an `Error.code` field so
  packs can route on the code without substring-matching.

### The mock implementations

Two mocks exist, mirroring the two contracts:

- `createMockHostApi()` in `corpan/packs/sdk/index.js` returns
  sample entries (`"hola"` / `"hello"`) and uses the browser's
  `SpeechSynthesisUtterance`. The prototype SDK's mock.
- `createMockHostApi(readerName)` in
  `corpan/packs/shared/sdk/mockHostApi.ts` is a thirty-line
  console-logger that returns a default `StackConfig` and stubs
  the rest. Catalog packs' mock.

Both serve the same purpose: a pack's `npm run dev` works without
the Corpán app in the loop, and the developer can see the pack in
a browser tab on `http://localhost:5173/`. The mock is the dev
loop's lifeline.

### The lifecycle

A pack's HostApi is alive only between the host's `mount(...)` call
and the corresponding `unmount` call. The host creates the API in
`ContentPackHost.tsx` just before mounting:

```ts
// simplified
const hostApi = createHostApi(packId)
const instance = pack.mount(containerEl, hostApi, initialState)
return () => instance?.unmount?.()
```

The cleanup discipline is the standard React effect pattern:
mount returns the unmount; the component holds it; unmount runs on
navigation away. The host does not aggressively garbage-collect
subscriptions the pack created against `onStackConfigChange`,
because the pack's unmount is supposed to drop them. A pack that
does not unsubscribe leaks until the page reloads.

### What the pack cannot do

The Host API is the **only** way out of a pack. By construction:

- The pack cannot reach the Corpán React tree. Its container is
  a DOM element, not a React node; the host treats whatever the
  pack renders as opaque.
- The pack cannot reach the Zustand stores. They live in the host
  app's module graph, which the pack's bundle does not import.
- The pack cannot call Tauri commands directly. There is no
  `invoke` exposed on the host side of the API; only the methods
  the host chose to expose.
- The pack cannot navigate to a different host screen. There is no
  navigation method on the API today.

These are all places the contract has held firm. The pressure to
add a backdoor ("just one more method that exposes the underlying
Tauri command") has shown up several times; every time, the right
answer has been to add a typed method to the contract rather than
let packs reach around it.

## Common operations

1. **Add a method to the contract.** Edit
   `corpan/packs/sdk/index.d.ts` (or `shared/sdk/types.ts` for
   catalog packs only). Implement the method in
   `corpan/corpan-app/src/contentPacks/hostApi.ts`. Implement the
   mock in the corresponding mock file. Bump the SDK version if
   the change is breaking; otherwise leave it. Add an entry to
   the SDK's `CHANGELOG.md` (if one exists yet; the prototype
   does not, but the shared SDK should).
2. **Find what host work a pack triggers.** Read the pack's
   imports of `HostApi`; every method called on it is a pack-to-
   host work edge. The host's `hostApi.ts` shows which Tauri
   command each method invokes.
3. **Diagnose a failed `speak` call in a pack.** Three places to
   look: the pack's call site (is the language code correct for
   the user's stack?), the host's `speakWithStackPrefs` helper
   (which voice did it resolve?), and the Tauri TTS plugin (did
   the platform's TTS engine accept the input?).
4. **Add a per-pack SQLite query.** Use `queryPackDb({ sql,
   params, dbName, maxRows })`. The host limits results to 500 by
   default (2,000 max). Only `SELECT` / `WITH` / `PRAGMA` /
   `EXPLAIN` statements are allowed; the Rust side enforces this
   in `lib.rs:90` (`ensure_readonly_sql`).
5. **Subscribe to settings changes from a pack.** Call
   `onStackConfigChange(listener)` once on mount; capture the
   unsubscribe; call it on unmount. Use the initial value from
   `getStackConfig()` to seed local state.
6. **Mock a method that is not in the default mock.** Pass an
   `overrides` argument to `createMockHostApi(...)` in the
   pack's standalone `index.html`. The SDK spreads it over the
   defaults; your `getEntryById` override wins for that dev run.

## Why we built it this way

A small, typed surface is the choice that pays for itself the most
slowly and the most surely. Every method on the HostApi has to be
designed by someone who is paying attention to what packs actually
need and what the host can reasonably commit to. The result is
that the methods that are there are load-bearing; nothing is
decorative.

The split between the maximal SDK and the narrower shared/sdk is
the codebase's way of acknowledging that not every pack needs
every method. The SDK's type is the upper bound; the shared/sdk's
type is what reader packs actually consume. New contributors
reading the shared/sdk see the small contract that runs the
catalog packs and can build against it without absorbing the
STT-flavored complexity that pronunciation coaches need.

The mock as a first-class implementation is the discipline that
keeps the contract honest. If a method is hard to mock, that is a
signal it has the wrong shape on the contract: it is probably
leaking implementation detail (Tauri command names, host store
internals, platform peculiarities) that the contract is supposed
to hide. The dev loop's friction is what enforces the contract's
quality.

The "no backdoor" position is the architectural commitment that
makes the rest of the system safe to evolve. The host can change
how it implements `getRandomEntry` (different filter relaxation,
different Tauri command shape, different store layout) without any
pack noticing, because packs read only what the contract exposes.
The same is true in reverse: a pack can switch from
`getRandomEntry()` to `getRandomEntries(20)` without the host
caring, because the host returned what the contract specified.

## To go deeper

- `corpan/packs/sdk/index.d.ts` end to end. Read every type,
  every comment. Twenty minutes invested here saves a day of
  guessing later.
- `corpan/corpan-app/src/contentPacks/hostApi.ts` end to end for
  the host's side of the same contract. Watch how the methods
  translate from contract shape into store reads plus Tauri
  invocations.
- `corpan/corpan-app/src/contentPacks/ContentPackHost.tsx` to
  see the mount/unmount lifecycle in React form.
- Section 14 for shared state stores; section 15 for the
  transport bar; section 16 (SQLite) for the pack-DB story
  `queryPackDb` rests on.

---

# 13. Pack Catalog

## What it is

The catalog is the shared chrome that wraps a reading pack. It is
what gives Earthgate Reader and Stargate Reader their library, their
"now playing" panel, their language switcher, their voice picker,
their book-detail view, their browse overlay, and their exit button.
The reader itself is responsible only for rendering one book at a
time; everything around it (and the lifecycle that swaps one book
for another) is the catalog.

The catalog is not its own pack. It is a library under
`corpan/packs/shared/catalog/` that catalog-style packs import. Two
packs ship it today (Earthgate Reader and Stargate Reader); Quest-
Ear uses parts of it; future reading-shaped packs will adopt the
same surface.

## How it fits

The catalog sits between the pack's `mount()` and the reader's
DOM. The pack's `main.ts` (section 11) calls `createAppShell(...)`,
which renders the command drawer and the catalog browser, then
calls the reader factory the pack provided when the user opens a
book. When the user opens a different book, the shell unmounts the
previous reader and mounts a new one in its place, all inside the
container the host gave the pack on `mount`.

The catalog is also where the user's library state lives. Installed
books are tracked in a Zustand-style store
(`libraryStore.ts`); per-narration playback history sits in
`narrationHistoryStore` (section 14); the drawer's open-or-closed
state is in `drawerStore`. The reader subscribes to these where it
needs to; the shell drives most of them.

## Files and entry points

`corpan/packs/shared/catalog/`:

- `index.ts`: the public API surface. Re-exports the types and the
  small set of functions catalog packs consume.
- `src/types.ts`: the catalog data shapes (`CatalogV2`,
  `CatalogNarrationEntry`, `CatalogGamePack`, `BookEntry`,
  `Character`, `VoiceProfile`, `NarrationKey`). 200 lines.
  Mirrors the JSON the catalog API returns.
- `src/catalogFetch.ts`: fetches the catalog v2 manifest from the
  configured base URL with caching. 323 lines.
- `src/catalogIndex.ts`: builds derived indexes over the raw
  catalog (by book id, by character, by series). 358 lines.
- `src/appShell.ts`: the shell itself. 2,662 lines: command
  drawer, browse overlay, book detail, narrator-detail wiring,
  dispose-remount logic for book switching, custom-section
  injection from readers. The center of gravity of this section.
- `src/catalogBrowser.ts`: the browse overlay inside the drawer.
  283 lines.
- `src/bookDetail.ts`: the per-book detail view rendered inside
  the drawer when the user taps a book. 328 lines.
- `src/narratorDetail.ts`: the per-narrator detail view (voice
  preview, install/uninstall, language metadata). 648 lines.
- `src/searchFilter.ts`: pure functions that group, filter, and
  sort catalog entries. 269 lines. Worth reading; no state.
- `src/installManager.ts`: the install/uninstall pipeline against
  the Tauri commands. 286 lines.
- `src/purchaseManager.ts`: the IAP integration. 619 lines.
- `src/libraryStore.ts`: the installed-narration registry. 84
  lines. The simplest store in the catalog.
- `src/voicePreview.ts`: voice preview playback for the narrator
  picker. 138 lines.
- `src/downloadProgress.ts`: progress reporting. 123 lines.
- `src/versionUtil.ts`: 18 lines, a single
  `hasUpdate(installed, latest)` helper.
- `src/catalog.css`: the shell's stylesheet. Themed via
  `--catalog-*` CSS custom properties so each reader pack can
  recolor the chrome without forking it.

## How it works

### The shell as the integration layer

`createAppShell(container, options)` is the single entry point. The
calling pack passes:

- `readerId`: the pack's id (e.g. `"earthgate"`).
- `readerVersion`: the pack's version string (used in the "About"
  surface of the drawer).
- `createReader`: the pack's `ReaderFactory`, which takes
  `(container, hostApi, initialState) => ReaderInstance`. The
  shell calls this every time the user opens a book.
- `hostApi`: the live HostApi (section 12).
- Plus a small handful of optional callbacks for sections of the
  drawer the pack wants to customize.

The shell's responsibilities, top to bottom:

1. Render the **command drawer** (the swipe-from-edge UI that
   houses the now-playing strip, the language switcher, the
   library, the browse button, and the exit). The drawer
   primitive lives in `@shared/ui/commandDrawer`; the shell
   stamps in the catalog-specific sections.
2. Fetch the catalog (`fetchCatalog`) and build the index
   (`buildCatalogIndex`). The result is what the browse overlay
   and the book-detail view render against.
3. Render the **catalog browser** when the user opens "Browse."
   Catalog browser uses `searchFilter` to group by series,
   filter by language, and sort by what the user has installed.
4. Handle the **book selection** flow. Tapping a book in the
   browser opens `bookDetail`; tapping "Open" in the detail
   triggers `installManager.installNarration(...)` if needed and
   then asks the shell to swap in a fresh reader instance.
5. **Dispose and remount** the previous reader on book switches.
   Readers are constructed per book; switching books is a
   `previous.dispose()` followed by
   `createReader(container, hostApi, { bookId, ... })`. The
   container element is reused; the reader's internal state is
   not preserved.
6. Render the **narrator detail** view when the user taps a
   narrator card. `narratorDetail.ts` handles voice preview,
   install/uninstall of the narration pack, language metadata,
   and progress reporting.
7. Surface **toasts**, **offline notices**, and the **drawer
   store** state changes through the existing shared UI
   primitives.

### Data flow

The catalog is JSON, fetched from a URL the pack configures
(typically pointing into S3 / CloudFront; see section 24). The
shape is in `types.ts`:

```ts
type CatalogV2 = {
  version: number
  characters: Character[]      // narrators with voice metadata
  books: BookEntry[]           // books and per-language metadata
  narrations: CatalogNarrationEntry[]  // the per-(book, lang, voice) zips
}
```

`buildCatalogIndex(catalog)` returns a `CatalogIndex` with helpers
to look up narrations by `(bookId, language, voiceId)`, by
character, by series, etc. The index is the read-side view; the
catalog itself is the source.

The library store
(`corpan/packs/shared/catalog/src/libraryStore.ts`) tracks which
narrations the user has installed locally. It is a small Zustand-
shaped store with a few helpers (`addInstalled`, `removeInstalled`,
`isInstalled`, `getInstalled`, `listInstalled`). The store
persists to local storage so the library survives app restarts.

### The pure functions in `searchFilter`

`searchFilter.ts` is the file new contributors should read first
when they want to understand the data side of the catalog. It is
269 lines of pure functions:

- `groupBySeries(narrations)`: groups by parent series.
- `filterByLanguage(narrations, lang)`: keeps only entries for
  that language.
- `searchByTitle(narrations, query)`: substring search over the
  user-facing title in the active locale.
- `getAvailableLanguages(narrations)`: enumerates which languages
  are present in the data.
- `getLanguageName(lang)`: looks up the user-facing language
  name.
- `partitionLanguagesByStack(languages, stackConfig)`: splits
  available languages into "in the user's active stack" vs
  "everything else." This is what drives the "Your languages"
  section at the top of the language picker.
- `sortNarrationsByStack(narrations, stackConfig)`: prioritizes
  narrations whose languages are in the user's stack. The browse
  list reorders itself when the user changes their language
  selection.

No state, no IO, no UI. This is where the catalog's
"hygienic and modular" reputation gets earned.

### The reader-shell handshake

The reader receives a slim contract from the shell on construction:

- The container DOM element to render into.
- The HostApi (passed through from the pack).
- An `initialState` that includes `bookId`, the audio manifest URL,
  the segments URL, an optional `baseUrl`, and an optional
  `contentRevision`.
- A small set of imperative callbacks the reader can invoke to
  ask the shell to do shell-level things (open the drawer,
  surface a toast, etc.).

The reader returns:

- `dispose()`: tear down all the reader's state and DOM. Called
  when the user picks a different book or exits the pack.
- A handful of imperative methods the shell can call back into
  (`setBookmark`, `setLanguage`, etc.) when the user makes a
  choice in the drawer that should affect the reader.

The shell does not reach into the reader's internals; the reader
does not reach into the shell's. The contract is one struct each
way. This is the same shape as the pack-host contract one level
out: small, typed, complete.

### The i18n bridge

`appShell.ts:62` defines `tt(key, defaultValue, params)`, a tiny
wrapper around `window.__corpanI18n.t(key, options)`. The host app
(`corpan-app/src/i18n.ts`) puts its live i18next instance on
`window.__corpanI18n` so packs can reach in for translations
without bundling i18next themselves. The wrapper falls back to the
default value (with manual `{{param}}` substitution) when the
window global is absent, which is exactly the standalone-dev case
the SDK's mock host handles for the rest of the contract. The
result: every user-facing string in the catalog flows through
`tt(...)` and Just Works in production and in dev.

This is the one place the architectural rule "packs talk to the
host only through the HostApi" is bent. The bend is small and
documented in the comment in place: i18next is too heavy to ship
in every pack, and exposing the host's instance through a single
named global is the smallest acceptable workaround. The
alternative (a method on the HostApi that takes a key and returns
a translated string) is on the table for future SDK revisions.

### Theming

`catalog.css` declares CSS custom properties on the
`.catalog-root` selector that the shell stamps into the DOM:

```css
.catalog-root {
    --catalog-bg: #2c1810;
    --catalog-fg: #e8dcc4;
    --catalog-accent: #c2410c;
    /* ... */
}
```

Earthgate Reader and Stargate Reader override these from their own
stylesheets. Earthgate goes warm-earth-tone; Stargate goes
mid-century-science-fiction. The shell does not know the colors;
it only knows the slot names. Adding a third catalog-style reader
with a third palette is a stylesheet, not a fork.

## Common operations

1. **Open the catalog in a running pack.** Tap the drawer trigger,
   tap Browse. The catalog overlay opens; languages along the top,
   series listed below.
2. **Add a new section to the drawer.** Extend the
   `DrawerSectionDef[]` the pack passes to `createAppShell`. The
   shell renders each section in the order it appears.
3. **Theme the chrome for a new reader pack.** Set the
   `--catalog-*` custom properties in the pack's stylesheet under
   a selector that matches the shell's container. Test by
   opening Stargate Reader and Earthgate Reader side by side;
   the same drawer should look correct in both palettes.
4. **Add a new searchFilter operator.** Write a pure function in
   `searchFilter.ts`, add a test (the helpers are
   straightforward to test), export from `catalog/index.ts`.
5. **Add a new field to the catalog JSON.** Extend `types.ts`.
   Update `catalogFetch.ts` if the field requires migration.
   Update `catalogIndex.ts` if the field powers a new lookup.
   Update consumers; the type system tells you where.
6. **Inspect what is installed.** Call `listInstalled()` from a
   pack; the shell's library section is also rendered from this
   list.

## Why we built it this way

The catalog is a library, not a pack, because the readers it serves
need to ship together and stay visually consistent. Two readers
that look like cousins and behave like cousins should share their
chrome and not their experience. A library is what gives them
that: same drawer, same browse, same install flow, different
paragraph rendering, different visual identity, different feel.

The shell-as-orchestrator pattern is what makes the
dispose-remount-on-book-switch story tractable. Readers do not have
to manage their own lifecycle when the user picks a different book;
they just dispose cleanly and trust the shell to create a fresh
one. The reader stays focused on "render this book"; the shell
stays focused on "which book is current."

The pure-function approach in `searchFilter.ts` is the part of
this library that is most quoted internally as "the right shape."
A few hundred lines of well-named, side-effect-free functions
that the rest of the code stitches together; nothing to mock,
nothing to instantiate, nothing to teardown. New filters are
trivially additive. New sort orders are trivially additive. New
display modes that need a slightly different grouping are
trivially additive. The reason the catalog has not collapsed
under its own weight is that the data side has stayed honest.

The CSS-custom-property theming is the smallest mechanism that
gives each reader visual ownership without giving it visual veto.
The shell controls the structure; the readers control the colors.
Forking the chrome to recolor it would be the worst-case outcome;
the property slots are how we avoid that.

The `window.__corpanI18n` bridge is a small dent in the
no-backdoor principle the rest of the pack system holds firm.
The dent is documented, narrowly scoped, and falls back gracefully
in standalone dev mode. It exists because the alternatives (every
pack bundles i18next; every pack works around it) are worse than
the bend, and because tests show the bend is not load-bearing
elsewhere. The principle is still that the next time we are
tempted to add a host-side global, we should add a HostApi method
first.

## To go deeper

- `corpan/packs/shared/catalog/src/searchFilter.ts` end to end.
  Twenty minutes; it is the easiest entrypoint into the library.
- `corpan/packs/shared/catalog/src/appShell.ts` skim. Read the
  comment at the top and the top-level function declarations
  before the bodies; the shape is more digestible than the size
  suggests.
- `corpan/packs/shared/catalog/src/types.ts` for the data
  contract. This is what `catalog v2` looks like on the wire and
  in memory.
- `corpan/packs/earthgate-reader/src/main.ts` and
  `corpan/packs/stargate-reader/src/main.ts` to see two different
  packs adopt the same shell.
- Section 14 for the shared state stores `appShell.ts` reads and
  writes; section 24 for the S3 / CloudFront catalog hosting.

---

# 14. Pack Shared State

## What it is

Packs need to remember things across mounts: the user's place in a
book, the user's preferences for that book, recently-used
narrations, whether the catalog drawer was open last. `corpan/packs/
shared/state/` is the small library that gives them a uniform shape
for doing it. Six files, 261 total lines, all of them written so
that the next contributor can read one and read the others in
minutes.

Two patterns coexist in this directory, and the rest of this section
is about the difference between them:

- **Per-pack factory stores**: a function that returns a store
  scoped to a string prefix. The pack calls the factory once at
  module load, passing its own prefix (`"earthgate-reader"`,
  `"stargate"`, etc.), and gets back a store that namespaces its
  keys in `localStorage`. Each pack has its own store; values are
  not shared.
- **Cross-pack singleton stores**: a single Zustand vanilla store
  created at module load with the `persist` middleware. Every pack
  that imports the file talks to the same store and sees the same
  state. Used for state that genuinely spans packs.

`bookMetaStore` is in the first category. `narrationHistoryStore`
and `drawerStore` are in the second.

## How it fits

Shared state is the runtime memory of the catalog. The catalog
shell (section 13) reads from `libraryStore` to render the user's
installed books, from `narrationHistoryStore` to power the
"recently-used" pill row in the narration switcher, and from
`drawerStore` to remember whether the drawer was open. Readers
(Earthgate, Stargate) read from `bookmarkStore` to resume at the
user's last position, from `bookMetaStore` to know whether to
reserve space for a chapter title, and from `prefsStore` to
restore their per-book settings.

The HostApi (section 12) does not expose these stores. The
discipline is: state that the host owns (settings, history of
phrases) sits in the host's Zustand stores and is reachable only
through `getStackConfig` + `onStackConfigChange`; state that the
packs own sits in `@shared/state` and is reachable directly by
import. The two never overlap.

## Files and entry points

`corpan/packs/shared/state/`:

- `bookMetaStore.ts`: 52 lines. Per-pack factory; per-book cache
  of metadata that does not change across language switches
  (currently just `hasChapters`).
- `bookmarkStore.ts`: 46 lines. Per-pack factory; per-book
  bookmark (timeMs, segmentIndex, language, savedAt).
- `prefsStore.ts`: 61 lines. Per-pack factory; generic typed
  preferences store with deep-merge over defaults.
- `narrationHistoryStore.ts`: 48 lines. Cross-pack singleton.
  Tracks the most-recently-used narrations across reader
  sessions; capped at 16; persisted as
  `corpan-narration-history`.
- `drawerStore.ts`: 36 lines. Cross-pack singleton. Tracks the
  drawer's open or closed state so packs that read it from the
  shell stay in sync.
- `index.ts`: 18 lines. Re-exports the public surface.

## How it works

### The per-pack factory pattern

`bookMetaStore.ts` is the canonical example. The whole store fits
on one page:

```ts
// corpan/packs/shared/state/bookMetaStore.ts:19
export type BookMeta = {
  hasChapters?: boolean
}

export function createBookMetaStore(prefix: string): BookMetaStore {
  function key(bookId: string): string {
    return `${prefix}:bookMeta:${bookId}`
  }

  return {
    load(bookId: string): BookMeta | null {
      try {
        const raw = localStorage.getItem(key(bookId))
        if (!raw) return null
        return JSON.parse(raw) as BookMeta
      } catch {
        return null
      }
    },

    save(bookId: string, meta: BookMeta): void {
      try {
        localStorage.setItem(key(bookId), JSON.stringify(meta))
      } catch { /* storage full or unavailable */ }
    },
  }
}
```

Three things to notice:

1. **The factory takes the namespace.** Each pack picks its own
   prefix. Earthgate's bookMeta lives at
   `earthgate-reader:bookMeta:<bookId>`; Stargate's at
   `stargate:bookMeta:<bookId>`. The two packs do not see each
   other's data even though they share the file.
2. **`localStorage` is the persistence layer.** No
   abstraction; no fancy serialization. The store is a thin shim
   around `getItem` / `setItem` with JSON in the middle. This is
   appropriate because a pack's webview-side storage **is**
   `localStorage`, both for manifest installs and for the
   `corpan-pack://` scheme zip installs (the WebView shares
   storage across origins for the install).
3. **All IO is `try`/`catch` to `null`.** A pack must never
   crash because storage was full or because a JSON parse failed
   on a key from an older format. The store either returns the
   value or returns nothing; never throws.

The docstring at the top of the file is the second instructive
part. It tells the future reader **why** the cache exists: the
transport bar needs `hasChapters` synchronously at mount time to
reserve a line of vertical space; the bookmark store cannot carry
this because bookmarks are not written until playback begins; a
returning reader has a cached meta from the first read. On the
first-ever read of a brand-new book there is one small layout
shift; on every subsequent mount the layout is stable from frame
one. The cache is what bridges the two.

That kind of comment is the practice the whole `@shared/state`
library tries to model. The code is short; the rationale is
preserved next to it.

### The cross-pack singleton pattern

`narrationHistoryStore.ts` shows the other shape:

```ts
// corpan/packs/shared/state/narrationHistoryStore.ts:1
import { createStore } from "zustand/vanilla"
import { persist } from "zustand/middleware"

const MAX_RECENT = 16

export const narrationHistoryStore = createStore<NarrationHistoryState>()(
  persist(
    () => ({ recent: [] as string[] }),
    { name: "corpan-narration-history" }
  )
)

export function recordNarrationUse(narrationId: string): void {
  if (!narrationId) return
  narrationHistoryStore.setState((s) => {
    const filtered = s.recent.filter((id) => id !== narrationId)
    filtered.unshift(narrationId)
    return { recent: filtered.slice(0, MAX_RECENT) }
  })
}

export function getRecentNarrations(): string[] {
  return narrationHistoryStore.getState().recent
}
```

This is Zustand without React. `createStore` from `zustand/vanilla`
returns a store that exposes `getState`, `setState`, and
`subscribe`. The `persist` middleware writes the state to
`localStorage` under the configured `name` on every change and
hydrates on first read.

The store is a module-level singleton because the file is a
singleton in the bundle, and the cross-pack contract is that any
pack importing `narrationHistoryStore` sees the same one. For
catalog packs this is exactly the right shape: a user switches
from Earthgate Reader to Stargate Reader, and the recently-used
narrations follow them across.

The two helper functions (`recordNarrationUse`,
`getRecentNarrations`) are the imperative API. The store object
itself is exported too, so consumers that want to subscribe can
call `narrationHistoryStore.subscribe(listener)` directly.

### The generic prefs store

`prefsStore.ts` is the most reusable of the three factory stores.
It takes a `defaults` object and returns a store whose `load`
deep-merges the stored value over the defaults:

```ts
export function createPrefsStore<T extends Record<string, unknown>>(
  prefix: string,
  defaults: T,
): PrefsStore<T> {
  // ...
  function deepMerge(target, source) {
    // recursive shallow-then-deep merge for plain objects
  }
  return {
    load(bookId) { /* deepMerge(defaults, stored) */ },
    save(bookId, prefs) { /* JSON.stringify, localStorage.setItem */ },
  }
}
```

This is what powers per-book reader preferences. Stargate's
oscilloscope toggle, waveform color, pulseRing config; Earthgate's
font size, theme, scroll behavior. The deep merge is the small
piece that earns the file its keep: adding a new pref field to the
defaults means existing stored values automatically pick up the
default for the new field, without a migration step.

The `<T extends Record<string, unknown>>` generic is what makes
the store typed per pack. Earthgate calls
`createPrefsStore<EarthgatePrefs>("earthgate-reader", DEFAULTS)`;
the returned `load` returns `EarthgatePrefs`, not `unknown`.
Section 07 covers this generic pattern in the TypeScript section.

### What persists where

The full picture of state in a running pack, by location:

```
Host (Corpán app's Zustand stores, src/store/):
  settings.ts             user-level prefs (languages, levels, rate, ...)
  history.ts              per-stack phrase history (last 1000)
  rating.ts               app-rating prompt counters
  phrasePacks.ts          installed phrase pack registry
  translations.ts         translation cache

Pack (shared/state, localStorage-backed):
  bookMetaStore           per-(pack, book): hasChapters
  bookmarkStore           per-(pack, book): time, segment, language
  prefsStore              per-(pack, book): typed reader prefs
  narrationHistoryStore   cross-pack: recently-used narrations (16)
  drawerStore             cross-pack: drawer open?

Catalog (shared/catalog, localStorage-backed):
  libraryStore            installed narrations
```

Three independent persistence surfaces. None of them is
authoritative beyond the device. None of them is synced across
devices today. The choice to keep this state local-only is
deliberate: it shrinks the architectural surface, and the only
state that genuinely benefits from cross-device sync (the corpus
itself, the installed packs) is already addressed by the catalog
+ S3 / CloudFront pipeline (section 24).

### Why two patterns and not one

The factory pattern serves "this state belongs to this pack and
should not be visible elsewhere." Bookmarks for Earthgate's books
are nobody else's business; namespacing them by prefix prevents
collisions.

The singleton pattern serves "this state spans packs and they all
need to see the same thing." Recent-narrations-across-readers,
drawer-open-when-shell-was-last-rendered: these are intrinsically
cross-pack, and the cost of a shared module is zero.

What this directory does **not** have is a pattern for state that
needs to round-trip through the host. That state lives in the
host's Zustand stores and is reached through the HostApi
(`getStackConfig`, `onStackConfigChange`). Adding a third pattern
for "host state" would muddy the boundary; routing it through the
contract is the way it works today.

## Common operations

1. **Add a new per-(pack, book) field.** Extend the `BookMeta`
   type (or the pack's prefs type). Existing stored values pick
   up the field as `undefined` automatically; the deep-merge in
   `prefsStore` makes the defaults version slightly easier.
2. **Add a new cross-pack singleton store.** Copy the shape of
   `narrationHistoryStore.ts`: `createStore<State>()(persist(
   initial, { name }))`. Export the store and a small imperative
   API. Re-export from `state/index.ts`.
3. **Inspect what is stored on a device.** From the in-app
   webview (dev mode), open Safari Web Inspector or Chrome
   DevTools, go to Storage → Local Storage, and read the keys.
   Catalog and per-pack keys are all there.
4. **Clear a single book's stored state.** Each factory store
   has a `clear(bookId)` if defined (the bookmark store has one)
   or you write the key directly:
   `localStorage.removeItem("earthgate-reader:bookMeta:foo")`.
5. **Migrate a stored format.** Read with the old shape, write
   with the new. Or: bump the namespace prefix
   (`"earthgate-reader-v2:..."`) so old data is invisible to the
   new code. The codebase has used both; the latter is simpler
   and the cost (the user's per-book prefs reset) has been small
   enough so far.
6. **Subscribe a non-React consumer to a cross-pack store.** Use
   the Zustand store's `subscribe(listener)` directly. The
   listener fires on every `setState`; return value is the
   unsubscribe.

## Why we built it this way

`localStorage` is the smallest persistence story that does the
job. A WebView's local storage survives app restarts, is per-
origin (or per-WebView, depending on the platform), and has
megabytes of room before quota becomes a concern. The pack's
storage is the user's, on the user's device, full stop.

The factory pattern is the smallest discipline that prevents the
cross-pack collisions you would otherwise hit the first time two
packs both want to track "bookmarks" by `bookId`. One file, one
prefix per pack, no shared state. That the same file works for
Earthgate and for Stargate without either knowing about the other
is the architectural payoff.

The Zustand vanilla singleton is the second smallest discipline
that gives cross-pack state without dragging React into the
packs that do not use React (Hover Runner and Hanzipan do not).
`zustand/vanilla` is forty kilobytes; `zustand/middleware`'s
`persist` is another ten. The cost of the dependency is
negligible compared to the value of a single source of truth
for the narration-switcher history.

The docstrings on the small files are deliberate. Each store is
short enough that any contributor can grasp the mechanics in a
minute; the docstring is where the reason the store exists at
all is preserved. The `bookMetaStore` comment ("the transport
bar needs `hasChapters` synchronously at mount time…") is the
canonical example of that.

The decision **not** to add a third pattern (host-state
reachable from packs) is the architectural commitment that keeps
the HostApi load-bearing. If packs could subscribe to the host's
settings store directly, the contract in section 12 would mean
less; `onStackConfigChange` would become a vestigial wrapper. By
keeping host state behind the contract and pack state in
`@shared/state`, the seam stays meaningful.

## To go deeper

- `corpan/packs/shared/state/bookMetaStore.ts` end to end. Two
  minutes; the file is shorter than this paragraph.
- `corpan/packs/shared/state/narrationHistoryStore.ts` for the
  singleton pattern.
- Zustand docs at `github.com/pmndrs/zustand`. The vanilla and
  React stories are documented separately; this codebase uses
  both.
- Section 12 for the HostApi line; section 13 for where the
  catalog shell reads and writes these stores.

---

# 15. Pack Transport

## What it is

The transport bar is the playback control surface at the bottom of
every reading pack. Play and pause, skip thirty seconds backward and
forward, previous and next chapter, a scrub bar, the elapsed and
total time, and a two-line title strip that shows the book and the
current chapter. It is a single shared component at
`corpan/packs/shared/ui/transportBar.ts` (303 lines), styled per
pack via a CSS class prefix, and driven imperatively through a
typed contract that the reader binds to its audio engine.

The transport bar is part of `@shared/ui`, alongside the command
drawer (section 13), the chapter overlay, the narration switcher,
the offline notice, the toast, and the settings rows. None of those
are React. They are plain TypeScript modules that produce DOM and
expose imperative setters and event subscriptions. This is the
shape the pack-side UI library has settled into.

## How it fits

The transport bar is one of three pieces the catalog packs compose
to make an audiobook reader. The other two are the **reader**
(`createParagraphView` in Earthgate's case, a different renderer
in Stargate's) and the **audio engine**
(`@shared/audio/audioEngine.ts`). The transport bar takes user
input and emits events; the audio engine consumes those events and
produces playback; the reader renders the text and highlights the
current word.

Wiring those three together is the reader's job. Earthgate's
`game.ts` constructs all three, subscribes the transport bar's
events to the audio engine's methods, subscribes the audio
engine's tick updates to the transport bar's `setTime` and
`setProgress`, and lets the reader's paragraph view watch the
audio engine for word-level highlighting. The transport bar does
not know about the audio engine; the audio engine does not know
about the transport bar; they cooperate through the reader.

There is a second surface the transport bar engages: the **device
media session** (lock screen play/pause, AirPods controls, Wear OS
notifications). That integration lives in
`@shared/audio/mediaSessionAnchor.ts` and
`@shared/audio/nativeKeepAlive.ts`; together they expose Now
Playing metadata to the OS and route hardware control events back
into the same callbacks the on-screen transport already calls.
Section 18 covers the audio side; the transport bar is the
on-screen end of that loop.

## Files and entry points

- `corpan/packs/shared/ui/transportBar.ts`: 303 lines, the bar
  itself. The worked example for this section.
- `corpan/packs/shared/ui/index.ts`: re-exports
  (`createTransportBar`, `createChapterOverlay`,
  `createCommandDrawer`, `createNarrationSwitcher`,
  `showToast`, etc.).
- `corpan/packs/shared/audio/audioEngine.ts`: 757 lines, the
  audio engine the transport bar usually drives.
- `corpan/packs/shared/audio/mediaSessionAnchor.ts`: 117 lines,
  the lock-screen integration.
- `corpan/packs/shared/audio/nativeKeepAlive.ts`: 204 lines, the
  iOS / Android keepalive that lets playback survive
  backgrounding and routes hardware control events back to the
  pack.
- `corpan/packs/shared/state/bookMetaStore.ts`: 52 lines. The
  cache that lets the transport bar reserve space for the chapter
  title synchronously (section 14).
- `corpan/packs/earthgate-reader/src/game.ts`: the reference
  wiring of transport bar plus audio engine plus paragraph view.
- `corpan/packs/stargate-reader/src/game.ts`: the second
  consumer; same shape, different reader.

## How it works

### The contract

The transport bar's TypeScript type is a small imperative API:

```ts
// corpan/packs/shared/ui/transportBar.ts:1
export type TransportBar = {
  // Setters: the bar's display state
  setPlaying: (playing: boolean) => void
  setBookTitle: (title: string) => void
  setChapter: (title: string) => void
  setHasChapters: (value: boolean) => void
  setTime: (currentMs: number, totalMs: number) => void
  setProgress: (fraction: number) => void
  setChapterMarkers: (fractions: number[]) => void

  // Events: the user's input
  onPlay: (cb: () => void) => void
  onPause: (cb: () => void) => void
  onPrevChapter: (cb: () => void) => void
  onNextChapter: (cb: () => void) => void
  onSkipBack: (cb: () => void) => void
  onSkipForward: (cb: () => void) => void
  onScrubStart: (cb: () => void) => void
  onScrubMove: (cb: (fraction: number) => void) => void
  onScrubEnd: (cb: (fraction: number) => void) => void

  dispose: () => void
}
```

Read this as the reader's view of the bar. Eight setters tell the
bar what to render; nine event subscriptions tell the bar what to
report when the user interacts. The bar holds the DOM; the reader
holds the audio engine. The seam between them is this struct.

There is no internal state the reader can read off the bar.
`setPlaying(true)` does not return a "is playing" getter; the
reader is the source of truth for playback state and the bar is a
view. When the audio engine pauses, the reader calls
`setPlaying(false)`; when the user taps the bar, the bar calls
the `onPause` callback and the reader pauses the engine and then
echoes it back with `setPlaying(false)`.

### The layout, in the comment

The docstring above `createTransportBar` is the small piece of
prose that documents the bar's visual structure better than any
class diagram could:

```
Layout:
   Top row:    book title
               chapter title           [elapsed / total]
   Scrub:    [═══════════●═══════════════════════════════════]
   Bottom:   [⏮]  [−30]  [▶/❚❚]  [+30]  [⏭]

The book prefix and chapter sit in separate spans inside one flex
column so they stack vertically on the left; each truncates its
own text with its own ellipsis. The time label hangs unattached
on the right and can never overrun the chapter. When
setBookTitle("") is called the prefix span collapses
(:empty { display: none }) and the chapter title sits alone,
vertically centered against the time.
```

That paragraph is the design contract. Two stacked spans inside a
flex column means a chapter-only book and a book-with-chapter both
align cleanly; an empty book title disappears entirely thanks to
the `:empty` selector; the right-aligned time never collides with
the chapter title.

These are exactly the kinds of details that a CSS-in-JS approach
would have hidden inside generated class names. Here the layout
choices are visible in twelve lines of prose at the top of the
file that creates them; the actual implementation is dense but
readable, and the comments correspond to specific class names in
the resulting CSS.

### `setHasChapters` and the bookMetaStore

The reason `setHasChapters` exists at all is the rationale
documented in `bookMetaStore.ts` (section 14). The transport bar
needs to know **before** segments load whether the book has
chapters, so it can reserve a line of vertical space for the
chapter title; if it does not reserve the line, the layout jerks
when the title arrives async.

The handshake:

1. Reader calls `createTransportBar(parent, "earthgate")`.
2. Reader immediately calls
   `bar.setHasChapters(bookMeta.load(bookId)?.hasChapters ?? false)`
   from the per-book metadata cache. If the cache is hit, the
   bar reserves the line on frame one.
3. Once segments load, the reader checks the actual chapter index.
   If it differs from the cache, it calls `setHasChapters(actual)`
   and writes the result back to `bookMeta.save(bookId, ...)`.

The cost: on the very first read of a brand-new book, the cache
misses and the layout shifts once. The cost is acceptable because
it happens at most once per book per device.

### The classPrefix hook

`createTransportBar(parent, classPrefix)` takes a CSS class prefix
so each catalog pack can theme the bar:

```ts
// pack-specific stylesheet (earthgate)
.earthgate-transport { background: var(--earthgate-bg); ... }
.earthgate-transport-button { color: var(--earthgate-fg); ... }
```

Stargate uses `"stargate"`; Earthgate uses `"earthgate"`. The
transport bar's source does not name colors; the pack's CSS does.
This is the same pattern the catalog shell uses for its drawer
(section 13).

### The audio engine seam

The reader's wiring code is the most instructive part. Roughly:

```ts
const bar    = createTransportBar(container, "earthgate")
const engine = createAudioEngine({ ... })

bar.onPlay(()  => engine.play())
bar.onPause(() => engine.pause())
bar.onSkipBack(()    => engine.seek(engine.getCurrentMs() - 30_000))
bar.onSkipForward(() => engine.seek(engine.getCurrentMs() + 30_000))
bar.onPrevChapter(() => engine.seek(chapterIndex.prev(engine.getCurrentMs())))
bar.onNextChapter(() => engine.seek(chapterIndex.next(engine.getCurrentMs())))

bar.onScrubMove((fraction) => engine.seek(fraction * engine.getDurationMs()))

engine.on("tick", ({ currentMs, totalMs }) => {
    bar.setTime(currentMs, totalMs)
    bar.setProgress(currentMs / totalMs)
})

engine.on("play",  () => bar.setPlaying(true))
engine.on("pause", () => bar.setPlaying(false))
engine.on("chapterChange", (title) => bar.setChapter(title))
```

(Earthgate's actual wiring is more elaborate; this is the spine.)

Two things are doing the work here:

- **Events flow in both directions across the seam**, but the
  authority is one-way: the engine is the source of truth, and
  the bar reflects it. Tapping play does not flip the bar's
  state; tapping play tells the engine to play, the engine starts
  playing, the engine fires `play`, and the engine's fire is what
  updates the bar.
- **The reader is the wiring**. The bar does not import the audio
  engine; the audio engine does not import the bar. The reader
  imports both and connects them. Replacing the audio engine with
  a different implementation (a streaming engine, a different
  segment loader) does not change the bar at all.

### The media session

`@shared/audio/mediaSessionAnchor.ts` wires the same audio engine
to the W3C Media Session API, which the WebView surfaces to the
OS. The OS then shows the book title, the chapter, the artwork,
and the play/pause buttons on the lock screen and the Bluetooth
device.

`@shared/audio/nativeKeepAlive.ts` calls into the Tauri plugin
`tauri-plugin-audio-keepalive` to register the app with the
platform's audio-session machinery so background playback does
not get killed by the OS. It also exposes a `__readerCmd` global
that the native side can call with `"play"`, `"pause"`,
`"skipForward"`, `"skipBack"`, `"seek"`, `"prevChapter"`, or
`"nextChapter"` when the user taps a hardware control. The reader's
game.ts wires `__readerCmd` back through the same callbacks the
on-screen bar uses.

The result: tapping play on the on-screen bar, tapping play on the
lock screen, double-tapping an AirPods stem, and pressing the play
button on a Bluetooth steering wheel are the same input to the
reader. The bar's surface is on-screen; the rest of the surfaces
land through the keepalive plugin; the reader does not know which
one is firing.

### `dispose`

The bar's `dispose()` tears down the DOM the bar created, removes
its event listeners, and clears its setter closures. Readers call
it as part of their own `dispose()` when the catalog shell signals
a book change. The reader's clean-up order matters: pause the
engine first, then dispose the bar, then dispose the engine, then
dispose the reader's own DOM. Doing it in the wrong order can
leave a callback firing into a disposed bar; this is one of the
cases the code comments call out explicitly in the readers.

## Common operations

1. **Add a control to the transport bar.** Add a setter and (if
   appropriate) an event to the type. Implement the DOM and CSS
   in `transportBar.ts`. Update the readers' wiring to subscribe.
2. **Style the bar for a new pack.** Define
   `.<prefix>-transport`, `.<prefix>-transport-button`, etc. in
   the pack's stylesheet. Pass the prefix when calling
   `createTransportBar(...)`.
3. **Hook the bar into a non-audiobook pack.** The same imperative
   API works for any "thing the user plays." Hover Runner does
   not use it (its loop is too different); a podcast pack
   would.
4. **Surface a new event from a hardware control.** Extend the
   `__readerCmd` signature in `nativeKeepAlive.ts` and the
   matching native plugin code; route the new command through
   the reader's existing on-bar handler.
5. **Time-format something other than `m:ss`.** The
   `formatTime(ms)` helper at the top of `transportBar.ts` is the
   single place; everything that displays time goes through it.
6. **Diagnose a layout shift on first chapter render.** Inspect
   the `bookMetaStore` cache for the book. If empty, the reader
   skipped writing it on a previous read or the prefix changed
   between reader versions.

## Why we built it this way

Imperative DOM components in a TypeScript library are the shape
the pack-side UI has settled into after trying several
alternatives. React is heavy for packs that already have a tight
draw loop; web components are awkward to type and awkward to
restyle; the imperative `createX(...)` factory returns a small
object the reader can call into and dispose. The library stays
small (3,000 lines total under `shared/ui` and `shared/audio`
combined), and the readers stay in charge of their own
lifecycles.

The transport bar's setter-plus-event split is the contract that
keeps the bar reusable. A bar that knew about an audio engine
would be specialized to one engine; a bar that only emitted
events would force every reader to reimplement display logic.
This split lets the same bar drive the reader's audio engine, the
media session's hardware controls, and a future reader that
streams audio over the network instead of from disk.

The `setHasChapters` + bookMetaStore pairing is a small example of
where the team's discipline shows up. The naive design (the bar
expands its layout when a chapter title arrives) is simple but
visually wrong on the first frame of the second read of a book; the
cached design (the bar reserves space synchronously from a
per-book cache) costs five lines of state plus three lines of
wiring per reader, and prevents the layout shift permanently.
The cost is documented; the alternative is documented; the chosen
approach is the one most respectful of the user's eyes.

The CSS-class-prefix theming is the same pattern as the catalog
chrome (section 13). One imperative factory, one stylesheet per
pack. No fork to recolor. No conditional rendering for "is this
Earthgate or Stargate." The pack's own selectors win because they
are the ones in the pack's loaded stylesheet.

The native-keepalive integration is the choice that makes
Corpán's audiobook experience competitive with native audiobook
apps. Without it, every backgrounded session would be killed by
iOS or Android within a minute; with it, the user can lock their
phone and listen for an hour, and the transport bar's same
callbacks are what handle the hardware controls. The complexity is
contained to two files; the surface the rest of the pack sees is
the same it would see in a foreground-only world.

## To go deeper

- `corpan/packs/shared/ui/transportBar.ts` end to end. Twenty
  minutes; the layout comment at the top is worth reading first.
- `corpan/packs/earthgate-reader/src/game.ts` for the canonical
  wiring of transport + audio engine + paragraph view.
- `corpan/packs/shared/audio/audioEngine.ts` for the engine side
  of the contract (section 18 covers the audio pipeline in
  depth).
- `corpan/packs/shared/audio/mediaSessionAnchor.ts` and
  `nativeKeepAlive.ts` for the lock-screen and hardware-controls
  story.
- Section 14 for the `bookMetaStore` that makes
  `setHasChapters` synchronous; section 13 for the command
  drawer the transport bar lives beside.

---

# 16. SQLite

## What it is

SQLite is an embedded relational database. There is no server, no
process to start, no network port to manage; SQLite is a C library
the application links against, and the database is a single file on
disk. The library handles parsing SQL, planning queries, doing
transactions, and writing pages to the file. The application
opens the file, asks questions, and gets answers, all in-process
and in-memory.

In this repo SQLite plays three distinct roles:

- The **content database** for the Corpán app: 80 MB or so of
  authored phrase corpus, embedded in the Tauri binary at
  compile time. The largest single artifact in the codebase, and
  the reason `*.sqlite3` is in Git LFS (section 03).
- The **per-pack databases** for packs that want one: Hanzipan
  ships its own SQLite of character data. The host serves these
  through `queryPackDb` on the HostApi (section 12) with a
  read-only SQL gate.
- The **Django CMS database** at `corpan/dja/db.sqlite3`: the
  development database for authoring. The Django ORM (section 19)
  reads and writes this; `make_release_sqlite.py` produces the
  read-only `release.sqlite3` that the app embeds.

The same engine in three roles, with three different access
patterns. This section covers what they have in common and what
they do not.

## How it fits

SQLite is the inner data layer. Above it, the React tree reads
through the Tauri IPC commands (sections 04, 06). Below it,
nothing; the storage stops here. The app does not talk to a
remote database; the marketing site does not talk to a database
at all. The user's device runs SQLite locally, against a file
that shipped with the app, and adds rows to it (history,
settings, etc.) through Zustand-store persistence layers that are
independent of the corpus DB.

The Corpán corpus is **read-only at runtime**. The Tauri host
opens the embedded database with `SQLITE_OPEN_READ_ONLY` and
`PRAGMA query_only=ON`; nothing the user does writes back to it.
User-mutable state (history, preferences, installed packs) lives
in separate Zustand stores serialized to JSON, not in the corpus
DB. This separation is what lets the app ship a new corpus DB on
every release without losing user state.

## Files and entry points

### The app's content database

- `corpan/corpan-app/src-tauri/src/db.rs`: 57 lines. Holds the
  embedded-DB constant, writes it to the app data directory on
  first launch or after an app update, opens a read-only
  connection with `mmap`, and sets the PRAGMAs.
- `corpan/dja/release.sqlite3`: the bundled artifact. Embedded
  into the binary via `include_bytes!("../../../dja/release.sqlite3")`
  in `db.rs`. Tracked in Git LFS.
- `corpan/corpan-app/src-tauri/src/lib.rs`: every `#[command]`
  that queries the corpus opens the lock on `DbState`, runs a
  prepared statement, and returns. Section 04 walks the IPC seam.

### The Django CMS

- `corpan/dja/cor/models.py`: 161 lines. The seven Django models
  that define the corpus schema (`Language`, `Domain`, `Entry`,
  `Translation`, `Narrator`, `Pack`, `PackEntry`). Section 19
  covers Django itself.
- `corpan/dja/db.sqlite3`: the development database. Tracked in
  Git LFS. Editing it via Django admin is how new entries enter
  the system.
- `corpan/dja/make_release_sqlite.py`: the script that exports
  `db.sqlite3` to a leaner `release.sqlite3` for the app to
  embed.

### Per-pack databases

- `corpan/packs/hanzipan/data/`: the directory inside the
  Hanzipan pack zip that contains its SQLite (and the
  hanziwriter character JSON). The pack's `manifest.json`
  declares its databases under the `databases` map (section 10).
- `corpan/corpan-app/src-tauri/src/pack_db.rs`: 84 lines. Opens
  per-pack SQLite databases on demand and caches the connection
  in `PackDbState`.
- `corpan/corpan-app/src-tauri/src/lib.rs:90`
  (`ensure_readonly_sql`): the four-statement allowlist that
  rejects anything other than `SELECT`, `WITH`, `PRAGMA`, or
  `EXPLAIN` before the SQL ever reaches SQLite. Section 12 calls
  out this gate.

## How it works

### The data model

SQLite is a relational database, which means data lives in tables,
each table is a set of rows, each row is a tuple of typed columns,
and queries are written in SQL. Three concepts to hold:

- **Tables and columns**. The `Entry` table holds the English
  phrases of the corpus, one row per phrase. Each row has an
  `id` (the primary key, an integer SQLite generates), an
  `en_text` (the English text), a `level` (the CEFR rating).
- **Foreign keys and joins**. The `Translation` table has a
  `entry_id` column pointing at a row in `Entry`. To fetch all
  translations of a given entry, you `JOIN translation ON
  translation.entry_id = entry.id`. The Django ORM hides this
  syntax; the Rust side writes it directly.
- **Indexes**. An index is a separate structure that lets SQLite
  find rows by a column value without scanning the whole table.
  The corpus DB has indexes on the columns the queries hit:
  `entry.level`, `translation.entry_id`, `translation.language_id`.
  Without indexes, a corpus query that should take a millisecond
  would take a second.

The schema is in `corpan/dja/cor/models.py`. Each Django model
class becomes a SQLite table; each field becomes a column. The
relationships (ForeignKey, ManyToManyField) become foreign-key
constraints and join tables.

### The schema, briefly

Seven tables for the phrase corpus:

```
Language(id, code, name)
    code is "es", "ko", "ko-polite", etc.

Domain(id, code, name, description)
    code is "travel", "business", etc.

Entry(id, en_text, level)
    level is "A0".."C2" CEFR; en_text is unique.

Entry_domains(entry_id, domain_id)
    Django's auto-generated M2M join table.

Translation(id, entry_id, language_id, text, romanization)
    Unique on (entry_id, language_id).
    romanization defaults to "".

Narrator(id UUID, name, language_id, description_pack_id)
Pack(id UUID, title, narrator_id, description_pack_id self-ref)
PackEntry(id UUID, pack_id, entry_id, order)
    Unique on (pack_id, order).
```

The `Entry` is the unit of corpus content. The `Translation`
table holds one row per (entry, language) pair. The `Pack` table
groups entries into ordered sequences (used both for narration
packs and for phrase packs). The `PackEntry` table is the
explicit join with ordering, because Django M2M tables do not
support ordering.

Sample row layouts:

```
Entry:        (42,  "I would like a cup of coffee.",  "A1")
Translation:  (193, 42, 7 [es], "Quisiera una taza de café.", "")
Translation:  (194, 42, 11 [ko], "커피 한 잔 주세요.", "keopi han jan juseyo")
```

The corpus has tens of thousands of entries, dozens of
languages, and hundreds of thousands of translations. The
release `*.sqlite3` is around 80 MB. With LFS the cost of
shipping it is one line in `.gitattributes` (section 03).

### The embed-write-mmap pattern

`db.rs` is the most production-incident-driven 57 lines after the
Android exit code (section 04). Read top to bottom:

```rust
const EMBEDDED_DB: &[u8] = include_bytes!("../../../dja/release.sqlite3");

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        let db_path = data_dir.join("release.sqlite3");

        let needs_write = match std::fs::metadata(&db_path) {
            Ok(meta) => meta.len() != EMBEDDED_DB.len() as u64,
            Err(_) => true,
        };

        if needs_write {
            std::fs::create_dir_all(&data_dir)?;
            std::fs::write(&db_path, EMBEDDED_DB)?;
        }

        Ok(Self { conn: Mutex::new(open_connection(&db_path)?) })
    }
}
```

Four phases:

1. **Embed**. `include_bytes!` is a Rust macro that reads the
   file at compile time and substitutes its bytes as a `&[u8]`
   constant. The 80 MB release database is baked into the binary
   as data. There is no separate file the app needs to ship next
   to the binary; the binary **is** the database.
2. **Write or skip**. On launch, the app checks whether
   `release.sqlite3` already exists in the app data directory
   with the right size. If it does, skip; if it does not (first
   launch, or app update with a new DB), write the bytes out.
3. **Open**. `open_connection` opens the on-disk file with
   `SQLITE_OPEN_READ_ONLY` and `SQLITE_OPEN_NO_MUTEX`; the
   in-process `Mutex<Connection>` provides the synchronization
   the no-mutex flag opts out of.
4. **PRAGMA setup**:
   - `PRAGMA query_only=ON` enforces read-only at the SQL level
     (belt and suspenders with the open flag).
   - `PRAGMA temp_store=MEMORY` keeps temporary tables in RAM
     instead of on disk.
   - `PRAGMA cache_size=-4096` (negative means kilobytes; this
     is a 4 MB page cache).
   - `PRAGMA case_sensitive_like=ON` makes `LIKE` actually
     case-sensitive (the SQLite default is case-folded, which
     would silently miscount.
   - `PRAGMA mmap_size=67108864` uses 64 MB of memory-mapped
     I/O. SQLite reads pages out of the OS page cache instead of
     copying them into private buffers; the OS handles eviction
     under memory pressure.

The comment in `db.rs` documents the rationale for writing the
DB to disk instead of feeding it to `sqlite3_deserialize`: the
deserialize path required SQLite to allocate one 80 MB
contiguous buffer at startup, which on lower-end Android devices
caused ANRs and SIGABRT crashes before the app's first frame.
Writing the bytes to disk and using `mmap` for reads is the path
that ships today.

### The connection lifecycle

`DbState` holds the connection in a `Mutex<Connection>` because
`rusqlite::Connection` is not `Sync`. Every `#[command]` that
touches the corpus locks the mutex, runs its query, and drops the
lock when the function returns. SQLite is fast enough that the
critical section is microseconds; the mutex contention is
invisible in practice.

The connection is opened **once** for the lifetime of the app and
parked in Tauri's managed state (section 04). There is no
per-call open; there is no connection pool. One connection,
behind one mutex, on a read-only file. This is exactly the shape
SQLite is happiest in.

### The query path

A worked example. The React side calls
`getRandomEntry`, which lands at
`get_random_entry_with_translations` in `lib.rs:497` (section 04
walks the signature). The function locks `DbState.conn`, runs a
prepared statement against the corpus, and returns. Roughly:

```rust
let mut stmt = conn.prepare(
    "SELECT id, en_text, level FROM entry
     WHERE level IN (?, ?, ?)
     ORDER BY random() LIMIT 1"
)?;
let entry = stmt.query_row(params!["A1", "A2", "B1"], |row| {
    Ok(Entry { id: row.get(0)?, en_text: row.get(1)?, level: row.get(2)? })
})?;
```

`prepare` parses and plans the SQL once. `query_row` runs the
plan and returns one row. The closure maps the SQLite columns
into a Rust struct. Errors anywhere become `Err(...)`; the
`#[command]` returns the error to JavaScript as a rejected
promise.

The translation half of the same call uses a second prepared
statement against the `translation` table joined to `language`,
with the entry id from the first query.

### The per-pack DB story

Packs that ship their own SQLite database (Hanzipan today; future
packs as needed) declare it in `manifest.json`:

```jsonc
{
  "databases": {
    "main": "data/pack.sqlite3"
  }
}
```

The host (`pack_db.rs`) opens the file on first use of
`queryPackDb`, caches the connection in `PackDbState`, and routes
subsequent queries to it. The SQL gate at `lib.rs:90`
(`ensure_readonly_sql`) is the safety net: only one statement at
a time, only `SELECT`/`WITH`/`PRAGMA`/`EXPLAIN`. The default row
cap is 500; the hard cap is 2,000. The pack's manifest does not
get to override this; the host enforces it.

The motivation is straightforward. A pack's bundled data is the
pack's own; the pack is the one that should know what to ask for.
Forcing the pack to round-trip every query through a Django HTTP
backend at runtime would defeat both the offline story and the
performance story. Letting the pack hit raw SQLite, but only for
reads, with a hard row cap, is the smallest gate that delivers
the use cases without exposing the corpus to runtime write
mistakes.

### The Django side

`corpan/dja/cor/models.py` is the authoring side of the same
schema. Django builds the same tables (via its migrations) and
provides a web admin (`/admin`) where humans create entries,
translations, narrators, and packs. `make_release_sqlite.py`
exports the development DB to a release file by stripping the
Django-internal tables, vacuuming, and writing the result
to `release.sqlite3` for the app to embed.

The split is the textbook editorial pattern: a heavyweight write
side (Django admin, Python, migrations, validation) and a
lightweight read side (the embedded SQLite in the app, hit
through Rust). Section 19 covers the Django half.

## Common operations

1. **Read the schema.** `sqlite3 corpan/dja/release.sqlite3 ".schema"`
   (after `git lfs pull`) lists every table and index. Compare
   against `corpan/dja/cor/models.py` to see how Django's models
   become SQL.
2. **Run a query against the bundled DB locally.**
   `sqlite3 corpan/dja/release.sqlite3
   "SELECT count(*) FROM entry"`.
   Same engine, same data; offline.
3. **Add a new column.** Edit `corpan/dja/cor/models.py`, run
   `python manage.py makemigrations`, then
   `python manage.py migrate`. Re-run `make_release_sqlite.py`
   to regenerate `release.sqlite3` for the app.
4. **Add a Rust query.** Use `conn.prepare(SQL)?.query_row(...)`
   or `query_map(...)`. Keep the SQL static and the parameters
   bound; never string-format SQL with user input.
5. **Inspect what a query plans.** Open the DB in `sqlite3` and
   prepend `EXPLAIN QUERY PLAN` to the query. SQLite tells you
   exactly which index it used (or did not use).
6. **Add a new pack DB.** Ship the SQLite as `data/pack.sqlite3`
   inside the pack zip. Declare it in `manifest.json`'s
   `databases` map. Use the pack-side `queryPackDb({ sql,
   params, dbName: "main" })`.

## Why we built it this way

SQLite embedded in the binary is the choice that makes the app
work on a plane. There is no server to be unavailable; there is
no API to time out; the app has the entire phrase corpus locally
from the moment the user installs it. The trade is binary size
(an extra 80 MB) and update cadence (a new corpus requires an
app update). For Corpán's user, the trade favors offline.

The read-only opening with explicit PRAGMAs is the small piece of
discipline that makes the embedded DB safe. `query_only=ON`
prevents accidental writes from a misplaced SQL statement; the
`mmap_size` and `cache_size` PRAGMAs are tuned to the device's
typical memory footprint. The `case_sensitive_like` setting is a
correctness fix for the search path (sections 04 and 12 mention
`search_entries_by_translation_text`).

The "write to disk and mmap" path instead of `sqlite3_deserialize`
is the lesson stamped into `db.rs` from a real shipped incident.
SQLite supports loading a database from in-memory bytes, which
would have been the obvious choice given the `include_bytes!`
embed; it was not the choice we shipped because the contiguous
allocation killed devices the app was supposed to run on. The
path that ships is documented; the path that does not ship is
documented in the same file as a warning.

Per-pack SQLite with a read-only SQL gate is the smallest design
that gives packs their own structured data without giving them
arbitrary write access to the user's device. The four-statement
allowlist is short enough to audit; the row cap is small enough
to bound the IPC payload. Hanzipan exists because of this seam;
future packs will too.

The Django authoring side is the choice that lets a small team
edit the corpus through a familiar web admin without rolling a
custom editor. Django and SQLite have shipped together for
twenty years; the boring tooling is the right tooling.

## To go deeper

- The SQLite documentation at `sqlite.org/docs.html`. The pages
  on the query planner, on `PRAGMA`, on `mmap` mode, and on
  `EXPLAIN QUERY PLAN` are concentrated and worth reading.
- *Use The Index, Luke* at `use-the-index-luke.com` for the
  general case of how indexes work. SQLite's query planner is
  not unique; the same intuitions apply elsewhere.
- `corpan/corpan-app/src-tauri/src/db.rs` end to end. Five
  minutes; the file rewards the second reading.
- `corpan/corpan-app/src-tauri/src/lib.rs` from `lib.rs:90`
  (`ensure_readonly_sql`) downward for the SQL gate, and from
  `lib.rs:496` for the `#[command]` query implementations.
- Section 19 (Python in the stack) for the Django side that
  authors the same schema.

---

# 17. Content Formats

## What it is

The packs that ship audiobooks read three JSON files per book. The
**book manifest** (`manifest.json`) identifies the book and points
at the renderer; the **segments file** (`segments.json`) holds the
authored text broken into renderable units; the **audio manifest**
(`audio_manifest_<lang>.json`) maps each segment to a rendered audio
file with per-word timestamps. The three together are the book's
on-disk shape.

These shapes are deliberate JSON, deliberately separate. The
manifest knows about the book as a thing the user installs (id,
title, series, metadata). The segments file knows about the text
as a thing the renderer paints (chapters, paragraphs, block types,
TTS hints). The audio manifest knows about the rendered narration
(file path, duration, word timing). When the reader plays a book,
it loads all three and reconciles them: which segment is the user
on, what does the text say, what audio file plays, where in that
file is the current word.

A fourth format set, the captures pipeline, lives under
`corpan/infra/captures/` and feeds the YouTube channel. Same JSON
discipline, different shape; section 25 covers it.

## How it fits

These formats are the contract between the authoring pipeline and
the runtime. Authoring (sections 19, 20) produces the JSON;
runtime (sections 11-15) consumes it. The two halves never share
a runtime; they share a file shape on disk.

The split between text and audio is the architectural lever the
reading packs depend on. The same `segments.json` is used by
every language (translations live in the text where appropriate,
or in side files). The audio manifest is per-language, because
each language is a separate Chatterbox run with its own forced
alignment. Adding a new language to an existing book is therefore
"render the new audio and drop an `audio_manifest_<new>.json`
next to the existing files"; the segments file does not have to
move.

## Files and entry points

### The format declarations

- `corpan/packs/shared/core/types.ts`: the TypeScript types every
  reader pack imports. Declares `AudioManifest`,
  `ManifestSegment`, `WordTimestamp`, `BookSegment`,
  `SegmentsData`, and `TimelineWord` (the derived per-word
  position the reader uses for highlighting).
- `corpan/packs/shared/data/segmentLoader.ts`: the fetcher.
  `loadSegments(url?)` and `loadAudioManifest(lang, url?)`.
- `corpan/packs/shared/core/timeline.ts`: `buildTimeline(segments,
  audioManifest)` produces the per-word absolute-time view the
  paragraph view highlights against.

### Sample data

- `books/<category>/<series>/<book>/pack/manifest.json`: the
  manifest for a book pack. `corpan/CHANGELOGS.md`'s "Narration
  series" row maps the per-book changelogs alongside.
- `books/<category>/<series>/<book>/pack/segments.json`: the
  text. v2.0.0 supports the standard prose shape, the
  `format: "dialog"` shape (with `speaker_id` per segment), and
  segment-typed shapes (text, image).
- `books/<category>/<series>/<book>/pack/audio_manifest_<lang>.json`:
  one per language the book has been narrated in. Maps each
  segment id (e.g. `"ch10-868"`) to the rendered audio file,
  total duration, and per-word timestamps.
- `books/<category>/<series>/<book>/pack/audio/<lang>/<segment>.m4a`:
  the audio files themselves. **Not** in git;
  `.gitignore`d under `**/pack/audio/`. Served from CloudFront,
  hydrated locally via `corpan/infra/hydrate-audio.sh`.

## How it works

### The book manifest

A book pack's `manifest.json` is the same shape as a regular
pack's (section 11), with two book-specific additions: `type:
"book"` and a `metadata` block:

```jsonc
{
  "id": "book_klondike_joe",
  "name": "Klondike Joe: The Canadian Who Saved a Queen",
  "version": "0.1.0",
  "type": "book",
  "entry": "dist/reader.js",
  "styles": ["dist/reader.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0",
  "metadata": {
    "series": "Fascinating Spies",
    "volume": 1,
    "author": "Corpora",
    "tts": true,
    "estimatedReadTime": "3-4 hours",
    "estimatedListenTime": "2.5-3 hours"
  }
}
```

The `entry` here is a thin reader bundle, not a self-contained app.
For catalog-style books (Earthgate Reader books), the entry is
boilerplate that pulls the pack's `segments.json` and
`audio_manifest_*.json` from sibling URLs and hands them to the
catalog shell. The catalog shell (section 13) picks the
right reader from the user's settings and renders the book.

The `metadata` block is what the catalog UI shows. `series` is the
key the catalog groups by in the browse view; `volume` is the
sort order within a series; `estimatedListenTime` is what the
catalog detail surfaces alongside the play button.

### The segments file

`segments.json` v2.0.0 is the authored text. Each segment is the
unit the reader renders and the unit the audio manifest indexes
into. A sample from a dialog-format book:

```jsonc
{
  "version": "2.0.0",
  "book_id": "ai-this-week-2026-05-13",
  "format": "dialog",
  "total_segments": 62,
  "segments": [
    {
      "id": "ch00-001",
      "chapter": 0,
      "title": "",
      "block_type": "text",
      "speaker_id": "host",
      "text": "Welcome to AI This Week. I am Vindy.",
      "text_markdown": "Welcome to AI This Week. I am Vindy.",
      "tts": {
        "text": "Welcome to AI This Week. I am Vindy.",
        "pause_after_ms": 583,
        "speaker_id": "host",
        "repetition_penalty": 2.0
      }
    },
    {
      "id": "ch00-002",
      "chapter": 0,
      "title": "",
      "block_type": "text",
      "speaker_id": "analyst",
      "text": "Good to be here.",
      "tts": { "text": "Good to be here.", "pause_after_ms": 537, "speaker_id": "analyst" }
    }
    /* ... 60 more segments ... */
  ]
}
```

Each segment carries:

- `id`: stable identifier (`"ch10-868"`-style). Sortable in
  rendered order; the audio manifest keys off the same string.
- `chapter`, `title`: chapter index and (optional) chapter title.
  Used to build the chapter index for the transport bar (section
  15) and the chapter overlay.
- `block_type` (or default text): `"text"` for prose,
  `"image"` for an inline image, and others as needed. The
  reader switches rendering by this field.
- `text`, `text_markdown`: the user-visible string. `text` is
  plain (used for word counts, search); `text_markdown` carries
  any inline formatting the renderer should preserve. Both are
  always English; non-English translations live in adjacent
  per-language files (the books that have them; some books are
  single-language).
- `tts`: the TTS hint block. `text` is the string actually
  spoken (may differ from the displayed text to nudge
  pronunciation; section 20 covers the discipline);
  `pause_after_ms` controls the silence between segments;
  `speaker_id` is the voice id for dialog books; per-segment
  Chatterbox params (e.g. `repetition_penalty`) can be set here.
- `image`, `image_alt`: present when `block_type: "image"`.

The big rule (per the auto-memory and section 20): `tts.text`
is TTS-only; `text` and `text_markdown` are display fields. They
are allowed to differ. Phonetic nudges in `tts.text` should not
use dashes (`"chahpoolinehs"` not `"chah-poo-lee-nehs"`); section
20 covers the discipline.

### The audio manifest

The audio manifest is the per-language render. It is keyed by
segment id and carries the file path, the duration, the
inter-segment pause, and word-level timestamps from forced
alignment:

```jsonc
{
  "segments": {
    "ch10-868": {
      "file": "audio/en/ch10-868.m4a",
      "duration_ms": 13200,
      "pause_after_ms": 800,
      "words": [
        { "word": "La",      "start_ms": 220,  "end_ms": 460  },
        { "word": "Mojarra", "start_ms": 460,  "end_ms": 1100 },
        { "word": "stela",   "start_ms": 1100, "end_ms": 1400 },
        /* ... and so on, one row per word ... */
      ]
    }
    /* ... and so on, one block per segment ... */
  }
}
```

The word-level timestamps come from whisper-cpp forced alignment
(section 21) over the rendered Chatterbox audio (section 20).
Each `word` is the literal token from the rendered text;
`start_ms` and `end_ms` are millisecond offsets within the
segment's audio file.

The `audio_manifest_<lang>.json` naming is deliberate: one file
per language, side by side in the same pack directory. Loading
the English audio for a book is `loadAudioManifest("en", url)`;
loading the Spanish audio is `loadAudioManifest("es", url)`. The
URL is the same except for the suffix.

### The TypeScript types

`corpan/packs/shared/core/types.ts` is the canonical schema in
typed form:

```ts
export type WordTimestamp = {
  word: string
  start_ms: number
  end_ms: number
}

export type ManifestSegment = {
  file: string
  duration_ms: number
  pause_after_ms: number
  words: WordTimestamp[]
}

export type AudioManifest = {
  language: string
  voice: string
  sample_rate: number
  segments: Record<string, ManifestSegment>
}

export type BookSegment = {
  id: string
  part: number
  chapter: number
  title: string
  text?: string
  type?: "image"
  image?: string
  image_alt?: string
  tts: {
    text: string
    pause_after_ms: number
  }
}

export type SegmentsData = {
  version: string
  book_id: string
  total_segments: number
  segments: BookSegment[]
}
```

(The on-the-wire `BookSegment` is a richer superset of this base
type; the dialog format adds `speaker_id`, `text_markdown`,
`block_type`. The base type captures what every reader can rely
on; the optional fields layer on top.)

These types are what the reader imports. Every JSON file that
arrives at the reader either matches one of these shapes or
fails to type-check the consumer that uses it. The contract is
the union of the JSON and the TypeScript.

### Building the timeline

`buildTimeline(segments, audioManifest)` in
`corpan/packs/shared/core/timeline.ts` is the function that
reconciles the two:

```
segments.json:     [seg00, seg01, seg02, ...]   (text, ordered)
audio_manifest:    { seg00: { file, words, ... },
                     seg01: { file, words, ... }, ... }   (audio, keyed)

buildTimeline -> array of TimelineWord:
  [
    { word: "Welcome", absoluteStartMs: 0,    absoluteEndMs: 320, segmentId: "ch00-001", wordIndex: 0 },
    { word: "to",      absoluteStartMs: 320,  absoluteEndMs: 460, segmentId: "ch00-001", wordIndex: 1 },
    ...
    { word: "Good",    absoluteStartMs: 6783, absoluteEndMs: 6960, segmentId: "ch00-003", wordIndex: 0 },
    ...
  ]
```

Each `TimelineWord` carries its absolute time in the entire book
(by accumulating segment durations and pauses), the segment it
belongs to, and its index within that segment. The paragraph
view binds the timeline to the DOM by attaching a span per word
with a data attribute; the audio engine ticks the current
position; `findCurrentWordIndex(timeline, currentMs)` returns the
index; the renderer adds a class to that span. The highlight is
the visible result.

### Why JSON, where we would reach for something else

JSON is the default for two reasons. First, it travels: every
text editor reads it, every language has a parser, every git
diff is readable. Second, it composes: the reader fetches JSON,
parses it with the runtime's built-in JSON, and works against
typed objects. There is no codec to maintain.

The places JSON has been a poor fit and we have reached for
something else:

- The phrase corpus itself: tens of thousands of entries, dozens
  of languages, hundreds of thousands of translations. SQLite is
  the right shape for that (section 16). JSON would be too
  large to ship and too slow to query.
- The audio. M4A and AAC for shipping; WAV for intermediates;
  Opus-in-OGG was tried and was rejected because iOS < 17
  silently fails to decode Opus-in-OGG in Web Audio (section 18).
- The book PDFs. LaTeX source compiles to PDF; the PDF is the
  shipped artifact.

The JSON files in this section are small enough to load fully
into memory at start of book and operate on as plain objects.
That property is the boundary.

## Common operations

1. **Inspect a book's segments.**
   `cat books/<category>/<series>/<book>/pack/segments.json | jq .total_segments`
   tells you how many segments the book has;
   `jq '.segments[0]'` shows the first one's shape.
2. **Inspect an audio manifest.**
   `jq 'keys' books/.../pack/audio_manifest_en.json` lists the
   segment ids that have rendered English audio. Compare against
   `jq '.segments[] | .id' segments.json` to see if any are
   missing.
3. **Render a missing language.** Add the language to the
   pipeline's job list, run the Chatterbox render (section 20),
   confirm whisper alignment (section 21), drop the resulting
   `audio_manifest_<lang>.json` and the audio files into the
   pack's directory. The audio files go to S3 via
   `infra/sync-voices-to-s3.sh` (section 24); the manifest
   travels in the pack zip.
4. **Add a new field to a segment.** Edit the type in
   `corpan/packs/shared/core/types.ts` (use an optional field if
   existing data should still parse). Update the renderer to
   read the new field. Update the authoring pipeline to write
   it. Old books continue to render correctly; new books carry
   the new field.
5. **Inspect a specific word's timing.**
   `jq '.segments["ch10-868"].words[5]' audio_manifest_en.json`
   shows the sixth word in segment `ch10-868`.
6. **Find books that ship a given language.** A small shell
   snippet:
   `find books -name 'audio_manifest_es.json' -print` lists
   every book that has a Spanish audio manifest.

## Why we built it this way

Three files per book is the smallest split that lets each file
have one job. The manifest is for cataloging; the segments are
for rendering; the audio manifest is for playback. Merging any
two would create a file with two reasons to change and two sets
of authors to coordinate.

JSON over a custom binary format is the choice that keeps the
authoring side honest. A pipeline that produces JSON can be
debugged with `jq` and inspected with a text editor; a pipeline
that produces a binary blob needs its own tooling. The cost (a
few megabytes more on disk per language for the audio manifest)
is paid by the network, not by anyone's debugging time.

Per-language audio manifests instead of one polyglot file is
the cheapest expression of the actual update pattern. A book
gains a language one at a time, on its own schedule; the
generated artifact is one file per language; the in-memory
shape is identical regardless. The book's directory is a
self-documenting menu of which languages it has.

The `tts.text` versus `text` split is a hard-won discipline.
Voice models hear differently from how human eyes read; phonetic
nudges that look ugly in print render correctly aloud. Section
20 covers the conventions; the format respects the distinction
by giving them separate fields.

Word-level timestamps in the audio manifest is what makes the
word-highlight feature in Earthgate Reader possible at all. The
choice to forced-align every rendered segment (section 21) is
expensive compared to "just play the file"; the result is the
reader experience that fits "calm" and "synced." Without
word-level data, the highlight would have to estimate, and
estimation is what kicks the reader out of trust.

## To go deeper

- `corpan/packs/shared/core/types.ts` end to end. Five minutes.
- A book pack's `manifest.json`, `segments.json`, and
  `audio_manifest_en.json` side by side, in `jq`, with a coffee.
  Pick a short book (`Three Questions` is canonical).
- `corpan/packs/shared/data/segmentLoader.ts` and
  `corpan/packs/shared/core/timeline.ts` for the consumption
  side.
- Section 18 for the audio production side; sections 20 and 21
  for Chatterbox and Whisper; section 24 for where the audio
  files actually live (S3 and CloudFront).

---

# 18. Audio Assets

## What it is

The audio assets are the rendered narrations that ship with Corpán's
audiobook packs. Each segment of each book in each language has its
own AAC-encoded M4A file at 64 kbps, mastered to a target of -22
LUFS integrated loudness and -3 dBTP true-peak. The files are
served from CloudFront and downloaded by the reader pack at
runtime; the per-segment timing data lives alongside in the audio
manifest (section 17), and the rendering pipeline that produces
them lives on the DGX Spark (section 22).

There is also a second class of audio asset: the **voice clone
reference** files. These are 15-second WAV recordings of each
narrator (Ian, Skylar, Ron, Vindy, August, Flo, and others) that
the TTS model uses as the cloning prompt. They live outside the
repo on Jeff's machine at `~/Desktop/corpan-voice-clones/` for the
working copies, and on S3 under `sources/voices/data/` for the
durable copies.

A third class lives inside pack zips for the few packs that need
small in-bundle vocal samples (Melopán is the canonical case):
16-bit PCM WAV at 24 kHz mono, silence-trimmed, one file per
sample. Why WAV and not Opus is the iOS WebKit codec story below.

## How it fits

The audio assets are the largest single class of artifact the
project ships. A single book in 23 languages is roughly 23 × ~50
segments × ~64 kbps = on the order of 100-200 MB of mastered M4A
total. The phrase corpus database fits in 80 MB; the audio fits
nowhere on a single GitHub release. S3 plus CloudFront is the
answer (section 24).

The audio also sits at the seam between the offline pipeline
(Spark, Chatterbox, Whisper, ffmpeg) and the runtime pack format
(section 17 walks the manifest). The pipeline produces the files
and the manifest as paired artifacts; the runtime trusts them as
paired artifacts. Diverging the two (regenerating audio without
regenerating the manifest) breaks word highlighting in the
reader.

## Files and entry points

### In the repo

- `corpan/NARRATION_SYSTEM.md`: the canonical doc for the
  authoring pipeline. Read first if any of this is unclear.
- `corpan/infra/hydrate-audio.sh`: pulls audio assets from S3
  onto a local machine for offline iteration. The
  `.gitignore`d `**/pack/audio/` directories get populated by
  this script.
- `corpan/infra/sync-voices-to-s3.sh`: pushes voice references
  from `voices/data/` up to S3.
- `corpan/infra/hydrate-voices.sh`: pulls voice references
  back down to `voices/data/` (for a fresh machine).
- `voices/scripts/sample_clone_audition.py`: produces audition
  clips of a candidate voice clone across short sample texts.
- `voices/scripts/sample_clone_premaster_experiment.py` and
  `_targets.py`: the LUFS-targeting experiments for the
  pre-mastering chain.
- `voices/scripts/sample_lra_test*.py`: loudness range tests.
- `voices/data/README.md`: documents the voices/data
  conventions.

### Outside the repo (state-locations note)

- `~/Desktop/corpan-voice-clones/`: Jeff's working copies of
  voice clones and rendered audition samples (per auto-memory).
- S3 bucket `corpan-prod`, region `us-east-2`: the durable
  store for both rendered audio and voice references.
- CloudFront distribution `d38iwc9748jekz.cloudfront.net`: the
  CDN that fronts the bucket for runtime download.
- `~/projects/ttsctl/`: the narration pipeline tool itself
  (lives on the Spark and on Skylar's workstation; not in the
  encorpora repo).

## How it works

### The shipping format: AAC in M4A at 64 kbps

The mastered output of the pipeline is an M4A file per segment
(`audio/<lang>/<segment-id>.m4a`). Encoding choices, from
`NARRATION_SYSTEM.md`:

- **Container**: M4A (MPEG-4 audio).
- **Codec**: AAC.
- **Bitrate**: 64 kbps mono.
- **Sample rate**: 24 kHz.
- **Channels**: mono.
- **Target loudness**: -22 LUFS integrated, -3 dBTP true-peak.

Why these specific numbers:

- **64 kbps AAC** is the lowest bitrate at which a narration
  voice is indistinguishable from the source under casual
  listening. Doubling to 128 kbps would double the bundle size
  for a difference the listener does not hear; halving to 32 kbps
  introduces audible artifacts. The number is the result of
  audition tests across the original voice set.
- **24 kHz** matches Chatterbox's native output sample rate
  (section 20). Resampling to 44.1 or 48 kHz would add CPU and
  bytes for no improvement; the voice's spectral content does
  not exceed 12 kHz.
- **Mono** because narration is mono. Two channels would double
  the file size and add nothing.
- **-22 LUFS** is a few dB below most music streaming targets
  (-14 LUFS) and a few dB above broadcast TV (-23 LUFS). The
  audiobook listening context (often quiet, often in bed) favors
  a softer target than music; -22 was settled on after side-by-
  side listening with Audible-released audiobooks.
- **-3 dBTP** leaves enough true-peak headroom that the codec's
  reconstruction does not clip on any device.

### The mastering chain

ffmpeg processes the raw Chatterbox output through a fixed chain
before encoding. From `NARRATION_SYSTEM.md:111`:

```
gain normalization
    → highpass (80 Hz)
    → declicker
    → FFT denoiser
    → noise gate
    → compressor (2:1)
    → limiter
    → AAC encode (64 kbps M4A)
```

Why each link:

- **Gain normalization** lifts or lowers the segment so its
  measured loudness lands near the target before the rest of
  the chain runs.
- **Highpass at 80 Hz** removes the sub-bass rumble Chatterbox
  occasionally emits on long breath phonemes. Below 80 Hz is
  felt, not heard, on phone speakers and earbuds.
- **Declicker** kills the sharp transients that show up at
  segment boundaries when the generator's residual energy is
  non-zero.
- **FFT denoiser** removes the broadband hiss that Chatterbox
  inherits from the voice clone's recording chain.
- **Noise gate** silences gaps below the speech threshold so
  inter-word breaths are not amplified by later stages.
- **Compressor (2:1)** evens out the dynamic range so quiet
  consonants are intelligible without loud vowels exceeding the
  true-peak limit.
- **Limiter** is the safety net for the true-peak target.
- **AAC encode** produces the M4A.

The chain is the same for every language and every voice. The
discipline is that the input variation (different voices,
different languages, different segment lengths) is absorbed by
the chain, not by the chain's parameters. A voice that needs
custom mastering is a voice that needs a different clone
reference first.

### Voice clones, briefly

Chatterbox is a zero-shot cloning TTS: given a 15-second WAV of
a voice and a text, it produces speech that resembles the voice.
The 15 seconds is the cloning prompt. Section 20 covers the
generation; the asset side is the WAV.

Per-voice files live at (working copies)
`~/Desktop/corpan-voice-clones/<voice-id>/<voice-id>.wav` and
(durable copies) `s3://corpan-prod/sources/voices/data/`. The
`voices/data/` directory in the repo holds only the metadata and
the exercise scripts; the WAVs themselves are gitignored under
`voices/data/*.wav`. Hydration runs `infra/hydrate-voices.sh`.

The pre-mastering scripts under `voices/scripts/` are the
experimentation surface. `sample_clone_premaster_targets.py`
applies a fixed pre-master chain (HPF, denoise, compressor,
loudnorm) at several LUFS targets (-22, -18, -14, etc.) to the
raw reference WAV, producing a per-target variant. The pre-mastered
references are then auditioned in Chatterbox to find the LUFS
target that gives the most consistent generation. The result is
that **voice references are themselves loudnessed** before
cloning, because the model's clone quality is sensitive to the
reference's level.

### The in-zip vocal samples and the iOS WebKit story

A small set of packs (Melopán, currently) bundle short vocal
samples inside the pack zip rather than streaming them. These are
not narrations; they are vocal hits, syllables, atmospherics. The
format choice for these is **not** AAC.

The reason is the iOS WebKit codec gotcha:

> iOS WebKit before iOS 17 silently fails to decode Opus-in-OGG
> via `AudioContext.decodeAudioData`. The load promise rejects;
> the catch clause sets `sampleLoaded = false`; the pack appears
> to load fine but the sample-based instruments produce silence.

Opus-in-OGG was an attractive format (small files, royalty-free,
ffmpeg supports it well). It fell out of contention after a real
shipped incident where a Melopán build worked on every test
device that had iOS 17 and silently failed on every device that
did not.

The shipping choice for in-zip samples is **16-bit PCM WAV at 24
kHz mono with silence trimmed**. A one-second vocal hit ends up
at 30-60 KB; a pack ships its full sample set in under a megabyte
and the iOS < 17 WKWebView decodes it without complaint. AAC in
M4A is a viable alternative for in-zip samples too, if the
target iOS version is verified to support it for the specific
file (the Web Audio decoder for M4A has its own minor quirks).

The smoke test the codebase encodes (per the auto-memory): run a
sample-only smoke test on the oldest target iOS in scope before
declaring a sample-bearing pack shippable. "Pack loads" plus
"sequencer plays" together are not enough; you have to hear the
sample.

### The Fascinating Curiosities pipeline as the worked example

The 12-volume Fascinating Curiosities series is the largest
single audiobook project the pipeline has shipped. At full scale:

- 12 books × ~50 segments × 23 languages = 13,800 segments
- ~30 seconds per segment on average = ~115 hours of audio
- ~7.5 GB of mastered M4A total
- One forced-alignment word table per segment, one audio
  manifest per (book, language) = 276 audio manifests.

The pipeline is the same as for a single book, run repeatedly:

```
manuscript.md
    → generate_segments.py     → segments.json
    → Claude subagent translate → segments_<lang>.json
    → ttsctl generate (Chatterbox)
                              → raw 24 kHz WAV per segment
    → stable-ts (Whisper medium)
                              → alignment_<lang>.json
    → 12-check validator      → retry-or-pass
    → ffmpeg mastering chain  → 64 kbps M4A
    → manifest builder        → audio_manifest_<lang>.json
    → ttsctl publish          → ZIP, S3 upload, catalog.json update
```

Each book runs the loop independently. A typical book at full
scale takes a few GPU-hours per language on the Spark; the 23-
language run is on the order of a day per book if everything
converges, longer if `tts.text` rewrites are needed (section 20
covers the convergence loop).

### Where the assets live during runtime

The reader pack does not ship the audio files in its zip. The
pack zip is `manifest.json` + `dist/` plus the `segments.json`
and `audio_manifest_<lang>.json` files; the audio sits on S3
behind CloudFront and is fetched per segment as playback
approaches. The pack's `manifest.json` (or the audio manifest
itself) carries the CloudFront base URL, and the audio engine
prefetches the next few segments while the current one plays.

This is what makes the on-device install footprint reasonable.
A book pack on disk is single-digit megabytes (manifest + reader
code + audio manifests for the languages the user picked);
playback streams from CloudFront. Cache headers on the audio
files are aggressive (the files never change for a given
version), so a re-listen is offline once the bytes have arrived.

## Common operations

1. **Hydrate audio for local development.**
   `./corpan/infra/hydrate-audio.sh <book-id>` pulls the rendered
   audio for one book from S3 into the local pack directory.
   The `.gitignore`d `audio/` folder gets populated; the
   audio_manifest references resolve.
2. **Upload a freshly mastered book.**
   The pipeline's `ttsctl publish` step does this; the manual
   equivalent is
   `aws s3 sync books/.../pack/audio/<lang>/
   s3://corpan-prod/.../audio/<lang>/`.
3. **Inspect a single segment's loudness.**
   `ffmpeg -i <segment>.m4a -af ebur128 -f null -` reports
   integrated LUFS, true-peak, and loudness range. Confirm the
   shipped target (-22 LUFS, -3 dBTP).
4. **Audition a voice clone variant.**
   `python voices/scripts/sample_clone_audition.py <voice-id>`
   runs the clone against a fixed set of sample texts and writes
   the resulting WAVs into the auditioning directory.
5. **Adjust the pre-master target for a voice.**
   `voices/scripts/sample_clone_premaster_targets.py` produces
   pre-mastered reference variants at several LUFS targets;
   audition them with Chatterbox and pick the target that gives
   the most consistent generation. Write the new reference back
   to S3 with `infra/sync-voices-to-s3.sh`.
6. **Verify an iOS < 17 sample plays.**
   Open the pack in a Safari running on the lowest iOS version
   you intend to support; play a sample-only smoke test. Do not
   rely on "the pack loaded" as evidence.

## Why we built it this way

Pre-generated audio over on-device TTS is the most consequential
decision in Corpán's sound. On-device TTS exists, ships with the
OS, and is free; the trade is that the user's experience varies
by device and OS version, that word-level highlighting is
unavailable, and that voice cloning is not yet shippable on
mobile. The seven reasons enumerated in `NARRATION_SYSTEM.md`
(quality, consistency, sync, offline, cloning, multilingual,
economics) are each individually defensible; together they make
the choice unambiguous for audiobook content.

The mastering chain is the part of the audio side most often
under-appreciated. Without the chain, raw Chatterbox output is
within range of "could ship" but ranges in loudness by 6+ dB
across segments, has audible breath rumble on long phonemes,
and produces occasional clicks at segment boundaries. With the
chain, every segment lands at the same loudness, with the same
spectral character, with no clicks. The user hears one book
read by one voice; the chain is what makes that true.

The 64 kbps AAC choice is the smallest file size that the team
cannot reliably distinguish from the master under blind listen.
The number is empirical, not theoretical. The same choice in
2010 would have landed at 96 or 128 kbps; the AAC encoder has
improved enough since that 64 holds.

The iOS WebKit Opus story is the kind of friction that a
plain-text comment in the auto-memory file is the right place
to capture. The cost of the bug was real; the cost of the
mitigation (WAV instead of Opus for in-zip samples) is a few
hundred kilobytes per pack; the cost of the comment is two
paragraphs. Future selves and future agents read the comment
and do not pay the cost again.

The split between voice references (S3) and rendered audio (S3
plus CloudFront) is one of the places section 26's "state
locations" map is non-trivial. Voice references are inputs to
the pipeline; rendered audio is its output; both live in the
same bucket but in different prefixes. Section 24 walks the
bucket layout.

## To go deeper

- `corpan/NARRATION_SYSTEM.md` end to end. This is the file the
  team treats as authoritative; section 18 is a faithful
  summary, not a replacement.
- `voices/scripts/sample_clone_premaster_targets.py` and
  `sample_clone_audition.py` for the empirical work that
  decided the LUFS targets.
- Section 17 for the audio manifest's word-timing role;
  section 20 for Chatterbox; section 21 for the whisper.cpp
  alignment; section 22 for the Spark; section 24 for the S3
  and CloudFront layout.

---

# 19. Python in the Stack

## What it is

Python lives in the parts of the project where the answer is "yes,
do that, and pull in the entire scientific computing world while
you're at it." The Django CMS that authors the phrase corpus. The
narration pipeline that produces audiobook audio. The infra scripts
that generate catalog assets, narrator variants, and the YouTube
captures. The smaller Django sub-projects in `arb/`, `panko/`, and
`total-history/`. The voice-clone experimentation scripts under
`voices/scripts/`. The book typesetting helpers that compose Lua and
LaTeX into PDF.

Python is **not** in the running app. The Tauri binary is Rust
(section 05); the React tree is TypeScript (sections 06, 07); the
pack runtime is plain JS or TypeScript (section 11). The line is
clean: anything that runs offline as part of authoring, generating,
publishing, or analyzing is Python; anything that runs on a user's
device is not.

## How it fits

Python is the language of the producer side. The pipeline that
takes a Markdown manuscript through translation, segment splitting,
TTS rendering, forced alignment, validation, mastering, and
publication (section 18) is Python end to end. The Django CMS that
authors the corpus is Python. The ffmpeg invocations that produce
the captures (section 25) are wrapped in Python. The YouTube
upload CLI is Python.

What Python is doing that nothing else in the stack does: reaching
for off-the-shelf ML, audio, and content packages in a single
`pip install` and stitching them into a pipeline in a few hundred
lines. Chatterbox (section 20) is a Python package. stable-ts /
whisper.cpp Python bindings (section 21) are how the forced
alignment is invoked. Django is a Python framework. ffmpeg is a C
binary, but every place we drive ffmpeg programmatically does it
from Python.

The seam between Python (producer) and the rest of the stack
(consumer) is a file shape on disk, every time. The corpus comes
out of Django as a SQLite database the Rust binary embeds (section
16). The audio comes out of the pipeline as M4A files and JSON
manifests the reader pack consumes (section 17). The captures come
out of the YouTube CLI as MP4 files and a `videos.json` log. No
Python runs at user-runtime; no user-runtime code runs in the
pipeline.

## Files and entry points

### Inside the repo

- `corpan/dja/`: the Django CMS for the phrase corpus.
  - `cor/models.py`: 161 lines, the seven models (section 16).
  - `cor/packs/`: the pack generation service that creates packs
    from text via `create_pack_from_text`.
  - `cor/fixtures/`: seed data for languages and domains.
  - `manage.py`: the Django CLI entry.
  - `make_release_sqlite.py`: the script that exports
    `db.sqlite3` to a release-ready `release.sqlite3` (section
    16).
  - `add_translations.sh`: a shell wrapper around a Python
    invocation that adds translations for a language.
  - `requirements.txt` (or `pyproject.toml`): the Django and
    related dependencies.
- `corpan/infra/generate-catalog-assets.py`: produces catalog
  thumbnails and metadata variants.
- `corpan/infra/generate-narrator-variants.py`: per-narrator
  variant generation.
- `corpan/infra/patch-catalog.py`: catalog-side maintenance.
- `corpan/infra/captures/`: Python ffmpeg drivers
  (`trim-deadair.py`, `mix-bgm.py`) and the YouTube CLI under
  `youtube/`.
- `corpan/tools/pack-i18n/`: per-pack translation tooling.
- `corpan/tools/phrase-packs/`: phrase pack authoring tooling.
- `corpan/scripts/dev/`: developer helpers (Python where it makes
  sense, shell otherwise).
- `voices/scripts/`: voice clone audition and pre-mastering
  experiments (section 18).
- `arb/djarb/`, `panko/djpanko/`, `total-history/djistory/`:
  smaller Django sub-projects. Each scoped to one topic
  (Arabic calligraphy, Panko language, Total History).
- `panko/pako/`: a Python package that provides the Panko
  pipeline. Has its own `requirements.txt`.
- `panko/requirements.txt`: dependencies for the Panko sub-tree.
- `yijing/build.sh`: shell, but composes Lua and LaTeX. The Lua
  filters in `yijing/hrule.lua` and `no_apostrophe_space.lua`
  are run through `pandoc` (which has its own Python wrapper
  ecosystem); the build itself is shell.

### Outside the repo

- `~/projects/ttsctl/`: the narration pipeline tool (`ttsctl`)
  itself. Not in the encorpora repo; lives on the Spark and on
  the workstation that drives the pipeline. Section 20 walks the
  pipeline; section 22 walks the Spark.
- Pip-installed Python environments for each of the above
  (typically managed with `uv` or `venv`).

## How it works

### Django as the corpus authoring CMS

`corpan/dja/` is a Django 5 project with a single app (`cor`) whose
seven models compose the phrase corpus (section 16). The
authoring side runs locally:

```bash
cd corpan/dja
python manage.py runserver   # admin at http://localhost:8000/admin
```

Authors create entries, translations, narrators, packs, pack
entries from the Django admin. The schema is the schema; the admin
is generated; the workflow is the standard Django admin loop. When
the corpus is in a publishable state, `make_release_sqlite.py`
exports it to a leaner file the Tauri binary embeds (section 16).

A small concession to scale: `cor/packs/service.create_pack_from_text(...)`
uses an LLM provider (OpenAI in the default; the call site has
options) to split a piece of source text into entries with CEFR
levels assigned, then writes the entries plus pack plus per-pack
ordering in one transaction. This is the kind of pipeline-shaped
work Django supports cleanly through management commands and
plain methods on a model.

### The narration pipeline

The narration pipeline (`ttsctl`) lives outside the repo. It is
the program section 20 (Chatterbox) and section 21 (Whisper) and
section 22 (Spark) describe in detail; from the encorpora repo's
perspective, it is a black box that takes a book manuscript
directory plus a `narration.yaml` and writes a publishable pack
zip back. The interface is the file system; the artifacts the
pipeline produces (segments.json, audio files, alignments,
manifests) are tracked under the appropriate book pack directories
when they are small enough, or sit on S3 when they are not
(section 24).

The pipeline is Python because: stable-ts is Python, Chatterbox is
Python, ffmpeg has a Python wrapper (subprocess works fine too),
and the orchestration is short enough that "loop over segments
with retries" is more naturally written in Python than in
anything else. The tool is on the order of low thousands of lines.

### The infra scripts

`corpan/infra/`'s Python scripts are small (a few hundred lines
each), focused, and shell-callable:

- `generate-catalog-assets.py`: produces catalog avatars,
  thumbnails, marketing crops at the various sizes the stores
  need.
- `generate-narrator-variants.py`: synthesizes per-narrator
  catalog variants.
- `patch-catalog.py`: surgical edits to a checked-in
  `catalog.json` between releases.

Each is the Python equivalent of "a Bash script that grew up." The
boundary the codebase honors: when a shell pipeline gets past
three pipes or starts juggling JSON, it migrates to Python.
Section 31 walks the shell side.

### The captures pipeline

`corpan/infra/captures/` is the system that produces the YouTube
videos for marketing. The Python pieces:

- `trim-deadair.py`: ffmpeg-driven silence trimming.
- `mix-bgm.py`: background-music mixing.
- `build-capture.sh` (shell) calls the Python pieces in sequence.
- `youtube/`: the YouTube upload CLI itself. Has its own
  `pyproject.toml` and `requirements.txt`. Authenticates with
  Google, uploads videos, sets metadata, manages playlists.

Section 25 covers the capture system end to end.

### The smaller Django sub-projects

`arb/djarb`, `panko/djpanko`, and `total-history/djistory` are
each smaller Django apps the team uses for adjacent content
projects (Arabic calligraphy, the Panko language project, and a
Total History authoring backend respectively). They share the
shape of the main `corpan/dja` (Django models + admin + a
release-export script) but are scoped to one topic and have their
own dependencies. They are in the repo because the same hands
edit them; section 02's monorepo discussion is the bigger frame.

### The voice scripts

`voices/scripts/` is the experimental Python that sits between
voice clone WAVs and Chatterbox. Each script is single-purpose
(audition this voice, target this LUFS, run an LRA test).
Section 18 walks them. They are Python because everything
upstream and downstream is Python, and because numpy and librosa
are the right tools for the audio-analysis pieces.

### Where Python is not

The line is bright. Python does not run on a user's device. There
is no Python in the Tauri binary; there is no `python` subprocess
the app spawns; there is no `.py` file in the pack zip. The pack
SDK is JavaScript (section 10); the runtime audio engine is
TypeScript (sections 15, 18); the pack manifest is JSON. When the
pipeline produces a Python artifact (a `.npy` array, a pickle, a
joblib dump), it is converted to a portable format (JSON, M4A,
PNG) before it leaves the producer side.

The motivating constraint: shipping Python on the device would
mean shipping a Python runtime, which on mobile is non-trivial
(Pyodide does not target WKWebView well; embedding CPython into
Tauri is plausible but unattractive). The pipeline / runtime
split absorbs the constraint cleanly.

### When Python is the wrong choice

Inside the producer side, Python is the default, but two cases
have pushed the team toward shell or directly to a native
binary:

- **Pure file-system pipelines with no logic.** A
  `find books -name segments.json | xargs jq ...` is a one-liner
  in shell; the Python equivalent has imports and a loop and an
  exception handler. The codebase's `infra/*.sh` files are these
  cases.
- **Hot inner loops.** When a pipeline step has to process
  millions of samples and Python's interpreter loop is the
  bottleneck, the step lives in C or Rust (with a Python
  wrapper). The Whisper-based forced alignment uses `whisper.cpp`
  through the `stable-ts` package precisely because Python doing
  the audio math directly is too slow.

The pattern: Python at the orchestration layer; native or shell
at the layer that does the actual work. Python is glue, not
performance.

## Common operations

1. **Add an entry to the corpus.** From `corpan/dja/`:
   `python manage.py runserver`, navigate to
   `/admin/cor/entry/add/`, fill in English text and CEFR level,
   add translations from the inline form. Run
   `python make_release_sqlite.py` to bundle.
2. **Author a phrase pack from text.** Use the Django shell or
   admin to call `Pack.create_from_text(text, language, ...)`;
   the LLM provider splits the text into entries. Inspect the
   resulting pack in the admin; promote when satisfied.
3. **Set up a fresh Python environment for the CMS.**
   `cd corpan/dja && uv venv && uv pip install -r requirements.txt`
   (or `pip install -r requirements.txt` in a venv if `uv` is
   not available). Run migrations with `python manage.py
   migrate`. Create a superuser with
   `python manage.py createsuperuser`.
4. **Run a Python script under `infra/`.**
   `python corpan/infra/generate-catalog-assets.py --help` for
   the per-script flags. Each is designed to be runnable from
   the repo root.
5. **Profile a pipeline step.** `python -X importtime` to find
   slow imports; `python -m cProfile -o out.prof script.py` plus
   `snakeviz` or `tuna` to inspect the result; for the audio
   work, `py-spy record` is often faster.
6. **Manage a per-script dependency.** The convention in this
   repo is to keep dependencies declared close to the consumer:
   `panko/requirements.txt`, `corpan/infra/captures/youtube/pyproject.toml`,
   `corpan/dja/requirements.txt`. Shared dependencies are
   duplicated rather than centralized, because the alternative
   (one monorepo-wide requirements file) would couple unrelated
   subsystems.

## Why we built it this way

Python wins where the ecosystem wins. Chatterbox is Python;
stable-ts is Python; numpy/scipy/librosa are Python; Django is
Python; the YouTube SDK is Python. Choosing a different language
for any of these would mean writing wrappers and missing the next
version of the underlying tool. The cost (per-process startup,
GIL contention on threaded pipelines, deployment friction on
mobile) is paid in places that do not need to scale to the
user's device.

The hard line at "Python does not run on the device" is the
choice that keeps the runtime small and predictable. The shipped
artifact is whatever Python produced, in a format the runtime
already speaks. The runtime never asks Python a question; it
reads a file Python wrote. This is the producer-consumer split
section 17 introduces; section 24 (S3) is the durable layer
between them.

Per-subsystem requirements files instead of a monorepo-wide
Pipfile / pyproject is a deliberate concession to the fact that
the panko pipeline does not need anything the captures pipeline
needs. A single requirements file at the root would force every
contributor running a single Python script to install every
dependency the project has ever used. The duplication cost is
real (`numpy` is listed in several files); the alternative cost
is much higher.

Django for the CMS rather than a hand-rolled admin is the choice
that lets a small team edit a relational corpus through a stable
web admin without writing it. Django and SQLite have been
shipping together for two decades; the admin auto-generates from
the models; the migration story is well-trodden. The day a
custom admin would be more valuable is the day the corpus
schema diverges enough from a relational fit that Django's ORM
is in the way. That day has not come.

## To go deeper

- The Django docs at `docs.djangoproject.com`. The "Models" and
  "Admin" chapters cover what `corpan/dja/cor/` is doing.
- Real Python's "uv" guide (`realpython.com/python-uv-package-manager`)
  for the per-subsystem environment workflow this codebase
  prefers.
- `corpan/dja/cor/models.py` and `corpan/dja/make_release_sqlite.py`
  for the most direct read of the authoring side.
- Section 16 for the SQLite schema; section 20 for Chatterbox;
  section 21 for Whisper; section 22 for the Spark.

---

# 20. Chatterbox

## What it is

Chatterbox is the text-to-speech model the audiobook narrations are
rendered with. It is a Python package, `chatterbox-tts`, currently
pinned at version `0.1.7`, MIT-licensed, by Resemble AI. The model
the pipeline uses is `ChatterboxMultilingualTTS`: a single neural
TTS that speaks 23 languages and that performs zero-shot voice
cloning from a 15-second WAV reference. Chatterbox is the engine
that turns a `tts.text` field in `segments.json` into a 24 kHz mono
WAV file of a specific voice reading that text, in any of the 23
supported languages, with no per-voice training step.

The cloning model is the whole point. Without zero-shot cloning,
producing 23-language narrations of one book in one voice would
require recording 23 voice actors or training 23 per-language
voice models. With it, one 15-second recording of Ian is enough to
synthesize hundreds of hours of Ian reading in Spanish, Hebrew,
Mandarin, Arabic, and beyond.

A separate Chatterbox "Turbo" model exists (English-only,
ultra-fast); the pipeline does not use it. All languages use the
multilingual model so the voice character stays consistent across
the catalog.

## How it fits

Chatterbox is the first stage of the offline pipeline. Upstream is
the manuscript and the segments file (sections 17, 19); downstream
is the whisper-based forced alignment (section 21), the
validator, the mastering chain, and the publisher (section 18).
The pipeline orchestrator (`ttsctl`, outside the repo, on the
Spark) drives all of them.

Chatterbox runs on the DGX Spark GPU (section 22) because the
model is large enough that CPU inference would be impractically
slow. The Spark is the only place in the project's hardware
inventory that runs Chatterbox at production scale; the rest of
the team's machines (Jeff's MacBook, Skylar's workstation) can
run it for one-off auditions and short samples, but a 23-language
render of a full book is a Spark job.

## Files and entry points

### In the repo

- `corpan/NARRATION_SYSTEM.md`: the canonical architecture
  doc. Sections "TTS Engine," "Convergence Loop," "Quality
  Standards," and "Hardware" cover the Chatterbox portion.
- `corpan/packs/shared/core/types.ts`: `BookSegment.tts`
  declares the per-segment TTS hint fields (`text`,
  `pause_after_ms`, `repetition_penalty`). Section 17 covers
  the format.
- `voices/data/`: voice clone WAV references (gitignored;
  hydrated from S3 via `infra/hydrate-voices.sh`).
- `voices/scripts/sample_clone_audition.py`: a thin wrapper
  that runs Chatterbox against a candidate voice clone with a
  fixed sample text set. Used to audition new clones.
- `voices/scripts/sample_clone_premaster_targets.py`: produces
  pre-mastered reference variants at several LUFS targets
  (section 18).
- Per-book `packs/<voice>-chatterbox-v<n>/narration.yaml`: the
  pipeline config for one (book, voice, version) tuple. Maps
  per-language voice references, sets TTS params, declares
  per-segment overrides.

### Outside the repo

- `~/projects/ttsctl/`: the narration pipeline. Owns the
  Chatterbox invocation, the convergence loop, the retry
  scheduler, and the per-segment validation feedback. Lives
  on the Spark and on Skylar's workstation.
- The Chatterbox model weights themselves, cached on the Spark
  under the Hugging Face cache directory.

## How it works

### One Chatterbox call, in shape

The pipeline calls Chatterbox once per segment, per language, in
the convergence loop:

```python
from chatterbox.tts import ChatterboxMultilingualTTS

tts = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
wav = tts.generate(
    text=segment.tts.text,
    language_id=lang_code,
    audio_prompt_path=voice_clone_wav_for(voice, lang),
    cfg_weight=...,
    exaggeration=...,
    temperature=...,
    top_p=...,
    min_p=...,
    repetition_penalty=segment.tts.get("repetition_penalty", 2.0),
)
```

(That is the shape, not the literal call site; the literal lives
in `ttsctl`.) Inputs are the spoken text, the target language id,
the path to the voice clone WAV, and a small set of generation
parameters. Output is a 24 kHz mono PCM tensor that the pipeline
writes to disk as a WAV.

### `tts.text` vs `text`

The single most consequential authoring discipline in the
pipeline is the split between `tts.text` (what Chatterbox speaks)
and `text` (what the user reads). They are allowed to differ.
The pipeline encourages it.

The pattern from real books:

| `text` (display)           | `tts.text` (spoken)          |
|----------------------------|------------------------------|
| `1986`                     | `nineteen eighty-six`        |
| `the Olmec`                | `the OHL-mek`                |
| `Chapullines`              | `chahpoolinehs`              |
| `H2O`                      | `H two O`                    |
| `etc.`                     | `et cetera`                  |

Two rules to internalize, both from the auto-memory and section
17:

1. **No raw digits in `tts.text`.** Chatterbox renders arabic
   numerals inconsistently; the validator catches it (the
   `Raw digits` check in section 18) and fails the segment. The
   fix is to spell numerals in `tts.text` while keeping them as
   digits in `text` for the user.
2. **Phonetic nudges in `tts.text` should not use dashes.**
   `chahpoolinehs` works; `chah-poo-lee-nehs` does not. Dashes
   are interpreted by the model and bias generation away from
   the intended phoneme stream. This is the kind of discovery
   the auto-memory keeps so future contributors do not pay the
   cost again.

The pipeline does not try to be clever about this. It speaks
exactly what `tts.text` says, then forced-aligns the result
against `text` (section 21) to get word timestamps the reader
displays. The alignment maps the spoken `chahpoolinehs` to the
displayed `Chapullines` automatically.

### Per-language voice mapping

Voice cloning is one-shot from a 15-second WAV, but the same
voice in a different language often sounds best from a clone
recorded in that language. The pipeline accommodates this
through `narration.yaml`:

```yaml
voice: ian
per_lang:
  en: ian-new-narration-try-more-chill-clear.wav
  es: ian-es-warm-narration.wav
  ko: ian-ko-careful.wav
  # ...
```

A book is "Ian reading"; the actual WAV the model clones from
is picked per language. The Hebrew narration of Genesis uses a
different Ian WAV than the English narration of Three Questions.

### Generation parameters

Chatterbox exposes a handful of generation parameters. The
pipeline sets pipeline-wide defaults and supports per-segment
overrides:

- `cfg_weight`: classifier-free guidance weight. Higher values
  hew closer to the cloned voice timbre at the cost of
  expressive variability.
- `exaggeration`: how dramatic the read is. Audiobook narration
  prefers low values; dialog books (multi-speaker formats) bump
  it up.
- `temperature`, `top_p`, `min_p`: sampling parameters. The
  pipeline uses small temperature and conservative `top_p` to
  keep generations close to the prompt distribution.
- `repetition_penalty`: the per-segment override most often
  tuned. The pipeline computes a default of 1.2-2.0 from the
  word-uniqueness ratio of the segment; very repetitive segments
  ("yes yes yes yes") get a higher penalty to avoid degenerate
  loops.

The `tts.repetition_penalty` field in `segments.json` (section
17) is the per-segment escape hatch.

### The convergence loop

A single Chatterbox call produces a WAV. The pipeline does not
trust it. From `NARRATION_SYSTEM.md`:

```
1. Generate TTS -> Align -> Validate -> Trim -> Master
2. Failed segments get RETRY with jittered TTS params
   (25% jitter, 10 retry schedules)
3. After max_retries (40), segments that won't converge need
   tts.text rewriting
4. Text rewrites are done by Claude subagents - different
   phrasing, same meaning
5. NEVER hard-trim hard_ending failures - only tail_energy /
   tail_spike can be trimmed
```

The loop is the heart of the pipeline. Generate, align,
validate, master; if anything fails, jitter the parameters and
try again; if the segment will not converge after 40 attempts,
rewrite the `tts.text` with an LLM (different phrasing, same
meaning) and start over. The rewrite is a fall-back; most
segments converge in one or two attempts.

The "NEVER hard-trim `hard_ending`" rule is the kind of
discipline encoded into the loop. A `hard_ending` failure
(section 18's check 13) means the model stopped mid-word; the
audio is unusable regardless of trim. Other tail failures
(spike, energy) can sometimes be trimmed; this one cannot. The
pipeline's per-failure handling is recorded in `ttsctl`'s
changelog directory (outside the repo, alongside the tool).

### The validator's feedback

The 12-check validator (section 18 enumerates the checks) is
what tells the loop whether a generation passed. It runs after
alignment, so failures know the word-level structure. Some
failures route to a retry with different parameters; some route
to a trim; some route to the segment being held for human
review. The lessons documented in
`~/projects/ttsctl/changelog/decisions/` (per `PIPELINE_STATE.md`)
cover the per-check calibrations: the Japanese `final_word_weak`
calibration, the catastrophic zero-duration detection, the
Hebrew nikkud requirement, and so on.

The pipeline's quality bar (from `NARRATION_SYSTEM.md`'s "Quality
Standards"): zero validation failures before publishing, no
arabic numerals in TTS text, no heading audio in manifests,
display text in manifest word entries (not phonetic), proper
primary-language handling for non-English source books, human QA
listening with iterative resync for any flagged segments.

### Current shipped scale

Per the snapshot in `NARRATION_SYSTEM.md:159`:

- Seven books (four U10 soccer titles, Genesis, Monte Albán,
  The Unconquered People).
- 41 narration packs published across 10 languages.
- About 35,000 audio segments rendered.
- Languages: EN, ES, PT, IT, FR, DE, AR, ZH, HE, KO.

These are the numbers at the time of `NARRATION_SYSTEM.md`'s
last update; they grow as new books and languages ship. The
canonical accounting lives in
`~/projects/ttsctl/changelog/decisions/`.

## Common operations

1. **Audition a candidate voice clone.**
   `python voices/scripts/sample_clone_audition.py <voice-id>`
   runs Chatterbox against a fixed sample set with the voice's
   current pre-mastered reference. Audition the WAVs that fall
   out.
2. **Add a new language to a book.** Add the language to the
   pipeline's `narration.yaml`. Provide a per-language voice
   reference (or fall through to the default). Translate
   segments using Claude subagents (or the Django admin if
   preferred). Render on the Spark; the convergence loop runs
   until done.
3. **Override `repetition_penalty` for one segment.** Add
   `"repetition_penalty": 1.8` (or whatever) to the segment's
   `tts` block in `segments.json`. Re-render that segment only.
4. **Rewrite a non-converging `tts.text`.** Hand the segment to
   a Claude subagent with the failure mode (e.g. `hard_ending`
   on the last syllable); take the suggested rephrasing; rerun.
   Keep `text` (display) unchanged.
5. **Verify the model speaks what you intend.** For a tricky
   word, render a one-segment test with several `tts.text`
   spellings and audition the results. The right spelling is
   the one that sounds right; the spelling that "looks right"
   often loses to the spelling that sounds right.
6. **Bump a narration pack version.** Re-render with the new
   parameters or text; bump the `version` field in the pack's
   `manifest.json`; promote `[Unreleased]` to a dated entry in
   `CHANGELOG.md`; publish via `ttsctl publish`.

## Why we built it this way

Zero-shot voice cloning is the architectural choice that opens
the language strategy. Without it, a book in 23 languages is 23
voice actors or 23 trained models; with it, it is one 15-second
recording and one Spark job. The trade is that the voice is the
Chatterbox model's interpretation of the reference, not the
reference itself. For long-form audiobook listening, the
interpretation has been good enough; for short-form spoken-word
content where the listener knows the voice intimately, it would
not be.

The convergence loop with jitter is the smallest mechanism that
makes a stochastic generator useful as a pipeline stage. A
deterministic TTS would either always pass or always fail; a
stochastic TTS that retries with jittered parameters converges
on a passing output for almost every segment. The few that do
not converge are the ones where the `tts.text` itself is
fighting the model; the rewrite step is the last resort.

The `tts.text` versus `text` discipline is what makes the
phonetic-nudge work pay for itself. The reader sees correct
spellings (`Chapullines`); the listener hears correct
pronunciations (`chahpoolinehs`); the alignment maps the spoken
nudge back to the displayed spelling. Without the split, the
nudges would leak into the reader; without the nudges, the model
would mispronounce hundreds of named entities per book.

The "no raw digits, no dashes in nudges" rules are entries in
the costliest kind of book in a codebase: the one that lists
the failure modes the pipeline has shipped against. Codifying
them in the auto-memory and in the validator is what keeps
future contributors from rediscovering them.

The pipeline's Python orchestration plus GPU model is the same
pattern as the rest of the producer side (section 19): Python
where the ecosystem is, native where the performance is.

## To go deeper

- `corpan/NARRATION_SYSTEM.md` end to end. Section 20 is a
  faithful summary of the Chatterbox-relevant portions, not a
  replacement.
- The `chatterbox-tts` package README on GitHub for the API
  surface and the model card.
- Section 17 for the `segments.json` shape Chatterbox consumes
  on its left; section 21 for the Whisper alignment that
  consumes Chatterbox's output on its right.
- `~/projects/ttsctl/changelog/decisions/` (on the Spark or
  Skylar's workstation) for the validator calibrations and
  failure-mode discoveries. The encorpora repo references the
  decisions from `PIPELINE_STATE.md` at the root.

---

# 21. Whisper

## What it is

Whisper is OpenAI's open-source automatic speech recognition model.
It is a transformer-based encoder-decoder trained on hundreds of
thousands of hours of multilingual audio with text transcripts, and
it does two things this project asks of it: **transcribe** speech
to text, and **align** known text to speech with per-word
timestamps. Both modes use the same model weights; they differ in
what is held constant.

In this project Whisper appears in two distinct contexts:

- **Offline forced alignment**. On the Spark, during the
  audiobook pipeline, the `stable-ts` package wraps Whisper
  `medium` to produce per-word start and end times over the
  Chatterbox-rendered audio. The output is the `words` array
  in `audio_manifest_<lang>.json` (section 17). This is the
  Whisper that gives reader packs their word-level highlighting.
- **On-device speech-to-text**. On the user's phone, the
  pronunciation coach pack uses `whisper.cpp` (a C/C++ port of
  Whisper) through the Tauri STT plugin (section 04) to
  transcribe the user's spoken practice attempts. The plugin
  runs Whisper on the device's CPU (or NNAPI on Android), with
  a model the pack installs at runtime. This is the Whisper that
  makes pronunciation drilling possible offline.

Two contexts, one model family, two completely different
deployment shapes.

## How it fits

The offline Whisper closes the loop between Chatterbox (section
20) and the reader (sections 15, 17). Chatterbox produces audio
from `tts.text`; Whisper aligns the audio against `text`; the
reader paints word highlights against the alignment. Without
Whisper, audiobook playback would be uniform-speed-estimate
highlighting; with it, the highlight tracks the actual word
boundaries, including all the model's natural pace variation.

The on-device Whisper closes a different loop: the user speaks
into the microphone, the pronunciation coach transcribes the
attempt, and the pack scores how close the transcript is to the
expected text. The Tauri STT plugin (section 04, walked in detail
in section 05) is the boundary; the whisper.cpp implementation
behind it on iOS and Android is the engine. The desktop side of
the plugin returns "not supported in this build" because no
desktop user is doing pronunciation practice on a laptop today;
when they are, the desktop side will grow real behavior.

## Files and entry points

### Offline pipeline

- `corpan/NARRATION_SYSTEM.md`: section "Whisper Alignment" has
  the canonical configuration (`stable-ts`, Whisper `medium`,
  the display-vs-tts word mapping rule).
- `corpan/packs/shared/core/types.ts`: `WordTimestamp`,
  `ManifestSegment.words` (section 17 walks the format).
- `~/projects/ttsctl/` (outside repo): the pipeline tool that
  runs `stable-ts` per segment.

### On-device

- `corpan/plugins/tauri-plugin-stt/`: the Tauri plugin (section
  05 walks the Rust side). The `prepare`, `start_session`,
  `stop_session`, `cancel_session`, `is_available`, `get_status`
  commands are the API surface; `models.rs` declares
  `WhisperParams` (the per-call overrides) and
  `TranscriptionResult` (the rich return including per-word
  timings, scores, and decoder diagnostics).
- `corpan/plugins/tauri-plugin-stt/.tauri/tauri-api/`: the
  vendored Tauri API directory.
- iOS plugin source (under
  `corpan/plugins/tauri-plugin-stt/ios/`, scoped through
  `register_ios_plugin(init_plugin_stt)`): wraps whisper.cpp's
  iOS XCFramework.
- Android plugin source (under
  `corpan/plugins/tauri-plugin-stt/android/`, scoped through
  `register_android_plugin("com.corpora.stt", "SttPlugin")`):
  wraps whisper.cpp via JNI.
- `corpan/packs/pronunciation-coach/`: the pack that consumes
  the STT API. Has its own `scoringTuning.ts` for the per-call
  `ScoringParams` overlay (section 05).
- `RUNBOOK_QUANTIZE_LARGE_Q8.md` (under `corpan/`): the runbook
  for quantizing Whisper `large` to Q8 for the on-device path.

## How it works

### Forced alignment, in the pipeline

The offline alignment runs after Chatterbox produces a segment's
WAV. The `stable-ts` package wraps Whisper in a "forced alignment"
mode where the known transcript is provided and the model is
constrained to output its own decoding while reporting per-word
timestamps. The pipeline uses Whisper `medium` for this; the
trade is accuracy versus speed. `medium` is fast enough on the
Spark (~314 ms per segment per `NARRATION_SYSTEM.md`) and
accurate enough that the resulting word timestamps land within a
few hundred milliseconds of the true word boundaries.

The alignment is per-segment, not per-book. Each `audio/<lang>/
<segment-id>.m4a` gets its own array of `WordTimestamp` entries
mapped against the segment's tokens. The alignment is recombined
into the audio manifest at publish time.

There is a subtlety the auto-memory and `NARRATION_SYSTEM.md`
both flag:

> Display text mapping: manifest words use the `text` (display)
> field, not `tts.text` (phonetic), so the reader shows correct
> spelling even when TTS uses pronunciation substitutions.

The model decodes the phonetic spelling Chatterbox spoke
(`chahpoolinehs`); the manifest writes the display spelling
(`Chapullines`). The mapping is by position. The pipeline knows
where each phonetic token came from in the original `text` and
writes the original token back into the manifest. The reader
displays correct spellings; the alignment is correct; the
listener hears correct pronunciation.

### Why `medium` and not `large-v3`

`PIPELINE_STATE.md` records the alignment-model history. The
pipeline used Whisper `base` for early shipped narrations; it
moved to `medium` because `base` missed too many first-word
detections in some languages; the pipeline experimented with
`large-v3` for catalog-wide realignment (the
`2026-04-24_whisper-large-v3-alignment.md` decision) when
`medium` was producing 46% zero-duration words on a problem
segment, which is the signature of the model failing to align at
all.

The choice that ships is `medium` for the routine pipeline pass,
with `large-v3` available for full-catalog realignment when
problem segments cluster. The cost trade-off is GPU time per
segment; on the Spark, `large-v3` is several times slower than
`medium`. Section 22 walks the Spark's performance envelope.

### whisper.cpp on the device

The on-device path is a different deployment of Whisper entirely.
`whisper.cpp` is Georgi Gerganov's C/C++ port of the model;
it runs on CPU with intrinsic optimizations (AVX, NEON, BLAS),
on Apple's Metal Performance Shaders on iOS, and on Android's
NNAPI where available. The model weights are quantized to Q8 or
Q5 to fit in mobile memory (`RUNBOOK_QUANTIZE_LARGE_Q8.md` is
the runbook for the Q8 step).

The Tauri STT plugin's mobile module (section 05's
`mobile.rs:30`) is the bridge: each Rust method calls
`self.handle.run_mobile_plugin::<T>("name", args)`, which routes
to the platform-native plugin (`SttPlugin` on Android,
`init_plugin_stt` on iOS), which calls whisper.cpp through the
appropriate FFI.

The pronunciation coach's loop:

```
[User taps "Record" in the pack]
            |
[pack: invoke stt.startSession({sessionId, language, expectedText, whisperParams})]
            |
[host: bridges to native plugin]
            |
[Android: SttPlugin starts AudioRecord, streams to whisper.cpp]
[iOS:     SFSpeechRecognizer fallback or whisper.cpp XCFramework]
            |
[User finishes speaking; pack calls stopSession({sessionId})]
            |
[Native plugin returns TranscriptionResult: text, words[], scores]
            |
[Pack scores the user's attempt against expectedText, displays result]
```

`TranscriptionResult` (in `tauri-plugin-stt/src/models.rs:137`)
carries the full diagnostic set: the transcribed text, the
per-word timings, the overall and component scores, the average
log-probability, `no_speech_prob`, `compression_ratio`,
`temperature`, the min and stdev of per-token logprob, and the
free-decode-vs-constrained-decode similarity. Section 05 covers
how the scoring rolls up from these.

### `WhisperParams`: passing through whisper.cpp's flags

`WhisperParams` in `tauri-plugin-stt/src/models.rs:38` mirrors
the C-side `whisper_full_params` struct field by field. Per-call
overrides from the pack reach all the way through:

```ts
sttApi.startSession({
  sessionId,
  language: "pa-Arab",
  expectedText: "...",
  whisperParams: {
    temperature: 0.0,
    no_speech_thold: 0.5,
    initial_prompt: "ਪੰਜਾਬੀ ਦੀ ਲਿਖਾਈ",  // bias the decoder to Gurmukhi script
  },
})
```

The pack uses `initial_prompt` heavily for low-resource non-Latin-
script languages (Punjabi in two scripts, Hebrew with nikkud,
Yoruba with diacritics) where the model's greedy decode otherwise
collapses to a wrong-script attractor. The docstring on
`WhisperParams.initial_prompt` (section 05 quoted it) is the
contract.

The wire-format gatekeeper rule from section 05 still applies:
any field not declared on the Rust struct is silently dropped at
the boundary. The set of fields on `WhisperParams` is exactly
the set of fields the iOS Swift `WhisperParamsArg` and the
Android Kotlin `WhisperParamsArg` accept; adding a new pass-
through is a four-file edit.

### CPU vs GPU on the device

On Android: the plugin runs whisper.cpp on CPU with NEON
optimizations. NNAPI is available in principle but has not been
the path that ships, because the gain is small on the model
sizes the coach uses and the configuration complexity is
high. Per the v0.12.6 release (`PIPELINE_STATE`), "Pronunciation
coach on Android CPU, whisper.cpp" is the shipped configuration.

On iOS: the plugin runs whisper.cpp's iOS XCFramework, which
can use Apple's GPU through Metal. The choice between CPU and
GPU is made per device per model.

The desktop side (`desktop.rs`) returns "STT not supported on
desktop in this build" because the pronunciation coach has not
shipped on desktop. The infrastructure is in place to add it; no
user has asked for it yet.

### Memory and the `availableMemoryMB` gate

`StatusResult.available_memory_mb` and `physical_memory_mb`
(section 05's serde rename war story) are the memory-headroom
fields the pack reads before switching to a larger whisper
model. On iOS the available reading comes from
`os_proc_available_memory()`; on Android from
`ActivityManager.MemoryInfo.availMem`. The pack uses this gate
to refuse to upgrade to whisper `large` on a device that does not
have the room.

## Common operations

1. **Align a segment offline.** From the pipeline machine (the
   Spark or Skylar's workstation):
   `python -c "from stable_ts import load_model; m =
   load_model('medium'); print(m.transcribe('<audio.wav>',
   prepend_punctuations='', word_timestamps=True))"`. For real
   pipeline use, drive through `ttsctl`.
2. **Test the on-device STT in a pack.** Use the pronunciation
   coach's standalone dev path or install it in the running
   Corpán app. Call `hostApi.stt.startSession(...)`, speak,
   call `stopSession`. Inspect `TranscriptionResult` in the
   pack's UI.
3. **Bias the model toward a non-Latin script.** Set
   `whisperParams.initial_prompt` to a short phrase in the
   target script. Watch
   `TranscriptionResult.free_vs_constrained_similarity` to
   confirm the bias took.
4. **Quantize a Whisper model for the device.** Follow
   `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md`. The output is a `.bin`
   file the pack ships and the plugin loads through `prepare`.
5. **Inspect alignment quality on a problem segment.** Look at
   the `words` array in the audio manifest. Zero-duration words,
   massive `pause_after_ms` between words, or words whose
   `start_ms > end_ms` are all symptoms of a failed alignment.
   `PIPELINE_STATE.md` enumerates the validator's checks for
   the same.
6. **Reproduce a failed transcription locally.** Capture the
   audio (the plugin exposes the raw WAV in dev builds), feed
   to a local Whisper installation with the same parameters,
   and compare. The on-device model and the desktop model are
   the same architecture; deltas come from quantization and
   device-specific paths.

## Why we built it this way

Two Whisper deployments instead of one is the simplest answer to
two different problems. The offline alignment needs a stationary
high-accuracy run over rendered audio; the on-device STT needs a
streaming low-latency run over microphone audio. Unifying them
would mean either taking the device's CPU constraint into the
pipeline (slowing the renders pointlessly) or pushing the
pipeline's quality bar onto the device (slowing the user's
phone). Two Whispers, two configurations; the model architecture
is the same.

`stable-ts` plus Whisper `medium` is the choice that converged
after several rounds of "which model and which wrapper." The
wrappers tested all produce per-word timestamps from the same
Whisper checkpoints; `stable-ts` is the one whose word boundaries
are most consistent across languages and which exposes the
forced-alignment mode the pipeline needs. `medium` is the largest
model whose runtime fits in the convergence loop's per-segment
budget on the Spark.

The display-text-in-manifest rule, mirrored from the
`tts.text`-versus-`text` discipline in section 20, is what makes
the phonetic-nudge workflow safe end to end. The model speaks
the nudge; the alignment captures the boundaries; the manifest
records the display spelling. The reader never sees the nudge.

whisper.cpp instead of the official PyTorch Whisper on the device
is a forced move: shipping PyTorch on a phone is not practical.
whisper.cpp is the alternative that runs in C with no Python and
that fits in the binary the phone wants. The same choice gets
made every place this codebase puts a Whisper on a phone or in a
Tauri plugin; the only question is whether to ship CPU, GPU, or
both, per platform.

The wire-format gatekeeper for `WhisperParams` (and for
`ScoringParams`) is the small piece of strictness that keeps
the per-call overrides honest across four code surfaces (Rust
plugin, Swift iOS plugin, Kotlin Android plugin, TypeScript
pack). Adding a parameter that the pack thinks should work but
that one of the native sides ignores is exactly the bug class
this gatekeeper prevents.

## To go deeper

- The original Whisper paper, *Robust Speech Recognition via
  Large-Scale Weak Supervision* (Radford et al., 2022). Open-
  access on arXiv.
- `stable-ts` on GitHub (`jianfch/stable-ts`) for the
  forced-alignment wrapper the pipeline uses.
- `whisper.cpp` on GitHub (`ggerganov/whisper.cpp`) for the
  on-device implementation. The README's section on quantization
  is the right entrypoint for the `RUNBOOK_QUANTIZE_LARGE_Q8`
  context.
- Section 04 for the Tauri command surface; section 05 for the
  Rust plugin internals; section 22 for the Spark hardware that
  runs the offline path.

---

# 22. The Spark

## What it is

The Spark is the project's GPU workstation. It is an NVIDIA DGX
Spark, GB10 (Blackwell architecture, compute capability sm_121),
with 128 GB of unified memory, running CUDA 13.0 and PyTorch built
against `cu130`. It is the only piece of hardware in the project's
inventory that runs Chatterbox and Whisper at production scale; the
team's MacBooks can do one-off short runs but not 23-language
renders of a full book.

The Spark lives in a fixed physical location (Skylar's office) and
is reached over the network through Tailscale. There is no
direct public access; the Tailscale tailnet acts as the perimeter.
SSH into the Spark from a tailnet-joined laptop, run a pipeline
job, leave it overnight, come back.

The Spark does not run the encorpora repo. It runs `ttsctl`, the
narration pipeline tool, which is a separate repository at
`~/projects/ttsctl/` on the Spark's disk. The connection between
the two is the file system: the pipeline writes audio files,
alignment files, and audio manifests onto the Spark's disk; from
there they sync to S3 (section 24); from there packs in this repo
or running on a user's device fetch them. The Spark itself is
never the runtime.

## How it fits

The Spark is the producer end of the producer-consumer split that
runs through the rest of the manual. Chatterbox (section 20) runs
there; Whisper forced alignment (section 21) runs there; the
ffmpeg mastering chain (section 18) runs there; the validator and
the convergence loop run there. The encorpora repo is what packs
the output into shipping artifacts; the Spark is what produces the
output.

The Spark also gives us a different kind of state location.
Section 26 walks the four-or-more places state lives; the Spark is
one of them, and the one most easily forgotten because it is
neither code (which lives in git) nor delivery (which lives on S3
and CloudFront). It is the working surface where audio is being
made before anyone else can see it.

## Files and entry points

### In the repo (references only)

- `corpan/NARRATION_SYSTEM.md`: section "Hardware" documents the
  Spark's spec (`GB10, sm_121, 128 GB unified, CUDA 13.0,
  PyTorch cu130`). The per-stage timings (Chatterbox ~2 s,
  Whisper medium ~314 ms, ffmpeg mastering ~100 ms) come from
  there.
- `PIPELINE_STATE.md` (at the repo root): a dated snapshot of
  what was running on the Spark, the in-flight realignment
  state, and the validator calibrations under way. Skylar
  maintains it.
- `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md`: the runbook for
  quantizing a Whisper checkpoint for on-device use. Run on the
  Spark; output `.bin` ships in the pack zip.
- `corpan/CHANGELOGS.md`: documents that narration packs
  produced on the Spark land in
  `books/<category>/<series>/<book>/packs/<voice>-<engine>-v<n>/`
  with their own per-pack `CHANGELOG.md`.
- `corpan/infra/sync-voices-to-s3.sh`, `hydrate-voices.sh`: the
  scripts that round-trip voice references between local
  machines and S3. The Spark uses the same scripts.

### Outside the repo (lives on the Spark)

- `~/projects/ttsctl/`: the narration pipeline tool itself. Owns
  the Chatterbox invocation, the convergence loop, the
  validator, the mastering chain, the publisher, and the
  per-decision changelog under
  `~/projects/ttsctl/changelog/decisions/`.
- The local copy of the encorpora repo on the Spark, used as the
  source of `segments.json` files and the destination for
  `audio_manifest_<lang>.json` outputs before publication.
- The Hugging Face cache for the Chatterbox weights.
- The whisper model weights for the alignment runs.
- The Spark-side per-book working directories, where intermediate
  WAVs accumulate before mastering and publish.

## How it works

### Hardware envelope

The Spark's specs set what the pipeline can do per night:

| Stage                      | Where it runs | Per-segment time |
|----------------------------|---------------|------------------|
| Chatterbox generation      | GPU (CUDA 13.0) | ~2 s             |
| Whisper medium alignment   | GPU (stable-ts) | ~314 ms          |
| ffmpeg mastering           | CPU (ffmpeg)    | ~100 ms          |
| Validator (alignment + waveform checks) | CPU | small        |

The end-to-end per-segment budget is dominated by Chatterbox.
With 128 GB of unified memory the GPU can hold Chatterbox plus
Whisper medium plus the working buffers for a per-segment loop
without paging; this is what makes the convergence loop's
"generate, align, validate, retry on failure" tractable.

The unified-memory architecture is the GB10's defining feature
for this workload: CPU and GPU share the 128 GB, so there is no
explicit copy across PCIe between Chatterbox output (GPU
tensors) and the whisper alignment (still GPU) and the ffmpeg
mastering (CPU). The cost of moving a 24 kHz mono WAV between
the two is zero.

### Tailscale and access

The Spark is on a Tailscale tailnet. The team's laptops are on
the same tailnet. Access to the Spark is by tailnet name, not by
a public IP, with the tailnet's mesh handling authentication and
encryption. Practically:

```bash
# From a laptop already joined to the tailnet:
ssh spark
# or with the tailscale-suggested name:
ssh ts-spark.<tailnet>.ts.net
```

There is no public SSH port. There is no need to keep a port
open on the office firewall. There is no VPN client beyond
Tailscale's small daemon. A new contributor's first step is to
get added to the tailnet; their second step is `ssh spark`.

The other Tailscale-fronted services on the Spark (for the team
that uses them) include a Jupyter server, an FTP-like sync
target for in-flight book directories, and an internal web UI
for `ttsctl`. None of those is public.

### The "develop locally, run on the Spark" workflow

The shape Jeff and Skylar use most:

1. **Author locally.** Edit `segments.json` in the encorpora repo
   on a laptop. Run the validator in a local Python venv to
   catch the easy mistakes (raw digits in `tts.text`, missing
   `pause_after_ms`, etc.) before the pipeline starts.
2. **Push to the Spark's checkout.** Either by `git push`-pull
   on the Spark (the Spark has its own clone of the repo) or by
   `rsync` over the tailnet (`rsync -avz books/.../pack/
   spark:~/encorpora/books/.../pack/`). The Spark's checkout is
   the pipeline's input.
3. **Kick off the pipeline.** `ssh spark` and run
   `ttsctl generate --book <book-id> --langs en,es,ko ...` (or
   the equivalent per the tool's current CLI). Tail the logs;
   most of the time you walk away.
4. **The Spark renders.** Chatterbox per segment, Whisper
   alignment per segment, validator per segment, ffmpeg per
   segment, retries on failure, optional `tts.text` rewrite via
   a Claude subagent for stubborn segments. Output lands on the
   Spark's disk in the per-pack working directory.
5. **Publish.** `ttsctl publish` zips the pack, uploads the
   audio files to S3 (section 24), invalidates CloudFront, and
   updates `catalog.json`. The catalog refresh is what makes
   the new pack visible to running Corpán apps.
6. **Optional: hydrate locally.** Back on the laptop,
   `./corpan/infra/hydrate-audio.sh <book-id>` pulls the audio
   from S3 into the laptop's local pack directory so the reader
   pack can be iterated against without re-rendering.

Step 4 is what the Spark exists for. Steps 1, 2, 3, 5, 6 happen
elsewhere; the Spark is the GPU at the center.

### What lives on the Spark and only on the Spark

Several artifacts and configs are Spark-resident and have not
been migrated into the repo or to S3:

- The `ttsctl` source tree under `~/projects/ttsctl/`. The
  decision was deliberate: `ttsctl` is the tool, not a part of
  Corpán's shipping surface, and it has its own development
  cadence with Skylar as the primary maintainer.
- `~/projects/ttsctl/changelog/decisions/` (the per-discovery
  decision logs: validator calibrations, model upgrades, the
  language-leak anti-pattern recovery, the soccer-book voice-
  ID natural-key incident). Each is a dated markdown file. The
  catalog of decisions is referenced from `PIPELINE_STATE.md`
  at the encorpora repo root, but the decisions themselves live
  on the Spark.
- The Hugging Face cache of Chatterbox weights and the
  whisper model checkpoints. Reproducible from the package
  versions but cached for the per-job startup cost.
- Per-book intermediate WAVs (before mastering). Not synced to
  S3 because they regenerate; the cost of keeping them is local
  disk only.

The implication for the rest of the manual: when section 26
maps state locations, "the Spark" is genuinely a fourth location
alongside the repo, S3, and the device. Several files of
load-bearing knowledge live only there, and the team's working
practice is to keep them there.

### Failure modes specific to the Spark

A pipeline run on the Spark can fail in ways the encorpora repo
does not see:

- The model cache becomes corrupted after a Hugging Face
  update; the fix is to clear the cache and let the next run
  re-download.
- A long convergence loop hits a `tts.text` rewrite step and
  the Claude subagent's rewrite is itself wrong; the run halts
  pending human review.
- The Spark's disk fills up with intermediate WAVs; `ttsctl`
  has a cleanup mode (`--cleanup-intermediates`) for this.
- A CUDA version mismatch breaks PyTorch's CUDA path;
  the runbook for restoring is currently captured in
  `~/projects/ttsctl/README.md` (on the Spark).

None of these is something the encorpora repo can fix; they are
all Spark-side. Tailscale plus SSH plus the runbook is the
remediation path.

## Common operations

1. **Connect to the Spark.** `ssh spark` from a tailnet-joined
   machine. If `spark` is not a configured short name, fall
   back to the tailnet name (`ssh ts-spark.<tailnet>.ts.net`).
2. **Run a pipeline job.** `ssh spark` and run `ttsctl generate
   --book <book-id> --langs <list>`. Tail the logs; walk away
   for a few hours.
3. **Resync the Spark's repo checkout from upstream.**
   `cd ~/encorpora && git fetch upstream && git checkout main
   && git merge --ff-only upstream/main`. Same fork/upstream
   arrangement as a laptop (section 03).
4. **Move an in-flight book to the Spark.**
   `rsync -avz books/<category>/<series>/<book>/
   spark:~/encorpora/books/<category>/<series>/<book>/`.
5. **Publish a finished narration.** `ttsctl publish --book
   <book-id> --pack <pack-id>` on the Spark; the script zips,
   uploads to S3, invalidates CloudFront, and patches
   `catalog.json`. Verify on encorpora.io that the new
   narration appears in the catalog.
6. **Inspect a decision log.** `ssh spark` and read
   `~/projects/ttsctl/changelog/decisions/<dated-file>.md`.
   These are the canonical history of why a validator threshold
   is the value it is.

## Why we built it this way

A single GPU workstation instead of cloud GPU rentals is the
choice that fits the scale and the budget. The pipeline runs
overnight, several nights a week; renting that throughput on a
cloud GPU at on-demand prices would be expensive, and reserving
it would be inflexible. A Spark in an office, accessed over
Tailscale, pays for itself in months and stays available for as
long as the project needs it.

The GB10's unified-memory architecture is the specific feature
that matters for this workload. Chatterbox and Whisper both run
in GPU memory; the mastering chain is CPU. On a discrete-GPU
machine, the segment WAV would have to move from GPU memory to
host memory (a PCIe transfer) before ffmpeg could see it. On
the GB10, the same address is both. The throughput gain is
material at scale.

Tailscale instead of a public SSH port is the smallest-surface
remote access model. The tailnet is a mesh of authenticated
endpoints; nothing about the Spark is on the public internet;
adding a new contributor is a Tailscale invite, not a firewall
rule. The cost (the Tailscale dependency) has been small
compared to the alternatives.

Keeping `ttsctl` on the Spark and not in encorpora is the
deliberate split between the tool and the project. The
narration pipeline is going to keep evolving (new models, new
validators, new mastering choices) on a cadence that does not
match Corpán app releases. Sharing the repo would force the
two cadences together; keeping them apart lets Skylar move on
`ttsctl` without bumping the app's CI on every change.

The per-decision changelog folder on the Spark is the practice
that earns the "do not relearn the same thing" property of this
project. Every shipped calibration started as a discovery in a
specific dated file; the file documents the symptoms, the
investigation, the fix, and the resulting threshold. Section 36
walks the system's evolution; the discoveries are where the
evolution comes from.

## To go deeper

- `corpan/NARRATION_SYSTEM.md` "Hardware" and "Convergence Loop"
  sections.
- `PIPELINE_STATE.md` at the repo root for the latest dated
  snapshot of Spark-side work in flight.
- `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md` for one specific
  Spark-run procedure.
- Tailscale's documentation at `tailscale.com/kb` for tailnet
  setup; the project's tailnet config itself is held by Skylar.
- `~/projects/ttsctl/README.md` (on the Spark) for the tool's
  own documentation. Section 24 covers the S3 destination side;
  section 26 maps the Spark as a state location.

---

# 23. 3D and Creative

## What it is

Creative-coding libraries are the engines that drive the
non-reading packs. Where Earthgate Reader and Stargate Reader
render text and audio (sections 13, 15), Hover Runner and Juice
Squeeze render 3D scenes; Quest-Ear is a 2D arcade game; Melopán
(currently on a branch) is a generative music sandbox. Each pack
picks the engine that fits its experience and otherwise stays
inside the same SDK contract (section 12) as every other pack.

Three engines appear in the tree as of `main`:

- **Babylon.js** (`@babylonjs/core` and `@babylonjs/loaders`,
  version 6.48): the WebGL-based 3D scene graph that Hover
  Runner and Juice Squeeze build their worlds in.
- **Phaser** (`phaser` 3.80): the 2D arcade-game framework that
  Quest-Ear runs on.
- **Tone.js** (referenced in Melopán's auto-memory note): the
  Web Audio framework Melopán uses for its aux-send delay /
  reverb architecture. Not present on `main` today; the
  Melopán branch is where it lives.

A fourth tool sits adjacent: **Blender**, driven from Python
build scripts in some packs to convert vector source assets
into GLTF / GLB meshes the engine loads at runtime.

## How it fits

These engines do not replace the SDK; they live inside it. Hover
Runner's `mount(container, hostApi)` creates a Babylon canvas
inside the container and runs the scene against the same
`hostApi` every other pack consumes. Quest-Ear's `mount(...)`
creates a Phaser game inside the container. The host does not
know any of this; the container is opaque from its side. From
the pack's side, the engine is just a UI library.

The engines are also where the line between "pack" and "shared
UI" lives differently from the catalog packs. Catalog packs
reach into `corpan/packs/shared/{ui,audio,catalog,state,data,core}`
for the chrome; 3D and creative packs typically import only
`@shared/sdk` for the contract and then build their own scene,
audio, and state systems on top of the chosen engine.

## Files and entry points

- `corpan/packs/hover-runner/`: the reference 3D pack. Babylon
  scene; SVG-to-GLB build pipeline.
  - `package.json` declares `@babylonjs/core` and
    `@babylonjs/loaders` as dependencies and `build:models` as
    a `blender --background --python` script.
  - `scripts/svg_to_3d_v2.py`: converts the Corpán logo SVG
    into a hierarchical GLB with an `EarPivot` node, using
    Blender as a CAD backend.
  - `src/core/`, `src/gameplay/`, `src/rendering/`,
    `src/audio.ts`: the gameplay loop and scene composition.
  - `src/assets/models/corpan_logo.glb`: the build output.
- `corpan/packs/juice-squeeze/`: Babylon scene, same engine,
  different gameplay.
- `corpan/packs/quest-ear/`: Phaser 3.80. `src/engine/`,
  `src/game/`, `src/data/` for the corpus side.
- `corpan/packs/melopan/` (on the `melopan` branch, not on
  `main`): the Tone.js sandbox. The auto-memory note
  `melopan-2026-05.md` records the v0.2.6 architecture and
  the HMR gotcha.
- Babylon.js documentation at `doc.babylonjs.com` and Phaser at
  `phaser.io` are the authoritative references; this section
  is a map, not a tutorial.

## How it works

### Babylon.js as a scene graph

Babylon.js is a JavaScript library that wraps WebGL into a
scene-graph API. A pack creates a `Scene` against a `<canvas>`
and an `Engine`, then populates the scene with `Mesh` nodes,
`Camera`s, `Light`s, and `Material`s. The engine runs a render
loop: `engine.runRenderLoop(() => scene.render())`. Each frame,
Babylon walks the scene tree, computes transforms, batches the
GPU draw calls, and presents the result.

Hover Runner's render loop is the canonical Babylon shape inside
a pack:

```ts
const canvas = document.createElement("canvas")
container.appendChild(canvas)
const engine = new BABYLON.Engine(canvas, true)
const scene = new BABYLON.Scene(engine)
// ... add camera, lights, meshes ...
engine.runRenderLoop(() => scene.render())
window.addEventListener("resize", () => engine.resize())
return {
    unmount() {
        engine.dispose()
        canvas.remove()
    },
}
```

The `unmount` returned to the host is the disposal path. Babylon
hangs onto WebGL resources (textures, buffers, shaders) until
`scene.dispose()` and `engine.dispose()` are called; failing to
dispose them on pack swap leaks GPU memory until the WebView
process restarts.

### The SVG-to-GLB build pipeline

Hover Runner's `build:models` script is one of the more unusual
pieces in the codebase. The brand mark
(`corpan/logo_mesh_hifi.svg`, hand-edited vector art) is the
source of truth; the pack ships a 3D GLB derived from it;
Babylon loads the GLB at runtime. The conversion runs in
Blender:

```
blender --background --python scripts/svg_to_3d_v2.py
```

Blender headless-imports the SVG as curves, extrudes them into
meshes, applies the coordinate-system transforms the script's
top-of-file comment documents (Blender Z-up vs glTF Y-up; the
script rotates +90 degrees around X to neutralize), and exports
to `src/assets/models/corpan_logo.glb`.

The pipeline encodes several pieces of working knowledge in
its docstring: the coordinate policy, the per-mesh sizing
constants (`TARGET_PYRAMID_WIDTH = 1.35`), the named pivots
(`EarPivot` above the pyramid), and the final filename
(`corpan_logo.glb`). The Python is short enough (a few hundred
lines) that the script is its own documentation.

The build runs on a developer's laptop with Blender installed;
CI does not run it. The artifact (the GLB) is committed to the
pack so the runtime build does not depend on Blender.

### Phaser as a 2D game framework

Phaser is the 2D equivalent of Babylon. A Phaser pack creates a
`Game` instance with a config (renderer, scale mode, scenes)
and Phaser owns the canvas, the input handling, the sprite
batching, and the audio. Quest-Ear's scene tree is a small set
of Phaser `Scene` subclasses (a title scene, a gameplay scene,
a boss-arena scene per the auto-memory's v0.4.0 note), each
with its own `preload()`, `create()`, and `update(time, delta)`
methods.

Phaser plays well with the pack contract because its lifecycle
maps cleanly onto `mount`/`unmount`:

```ts
const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width, height,
    scene: [TitleScene, ActionScene, BossArenaScene],
})
return { unmount() { game.destroy(true) } }
```

`game.destroy(true)` (where `true` removes the canvas from the
parent) is Phaser's idiomatic cleanup. Same discipline as
Babylon: dispose explicitly, or leak.

### Tone.js (Melopán, off-branch)

Tone.js is a higher-level layer over the Web Audio API. It
exposes typed synths (`PolySynth`, `MonoSynth`,
`MetalSynth`), effects (`Reverb`, `FeedbackDelay`,
`Compressor`), and a transport (`Tone.Transport`) that
schedules events on the audio clock instead of the DOM clock.

Melopán's auto-memory note describes an aux-send delay / reverb
architecture: synth voices route their dry signal to the
destination and a wet send to a `Reverb` / `FeedbackDelay` bus,
which itself routes to the destination. This is the standard
analog-mixer pattern in code.

Two practical notes from the auto-memory:

- **HMR gotcha**: hot reload re-runs the module that constructs
  `Tone` instances, leaving the previous instance still
  scheduled on the transport. The fix is the same as the
  Babylon dispose discipline: tear down before re-creating.
- **iOS WebKit codec gotcha**: see section 18. Opus-in-OGG
  silently fails to decode on iOS WebKit < 17; in-zip vocal
  samples ship as 16-bit PCM WAV.

### Creative-coding as a category

The four engines (Babylon, Phaser, Tone, plus Blender as a
build-side helper) share a conceptual shape that is worth
naming explicitly: each gives the pack a single object that
owns its own clock, its own scene graph or state machine, and
its own canvas or audio context. The pack constructs the
object on `mount` and disposes it on `unmount`. The host has
no business inside.

This is why the pack contract (section 12) is the shape it is.
A contract that surfaced the engine's internals to the host
would either force every pack to use the same engine or surface
the choice into the contract. Keeping the engine opaque and
exposing only the small HostApi is what lets Babylon, Phaser,
Tone, and any future engine coexist inside the same Corpán
app.

### Why these engines and not others

- **Babylon.js over Three.js**: Babylon ships a fuller default
  set (`@babylonjs/loaders`, physics integrations,
  TypeScript-first docs) that fits the "scene plus a few input
  handlers" pattern the 3D packs need. Three.js is the more
  popular choice, but its docs assume more boilerplate.
- **Phaser over a custom 2D engine**: Phaser is mature, has
  built-in physics (Arcade), sprite batching, and input
  handling. Quest-Ear is the kind of arcade game Phaser was
  designed for.
- **Tone.js over raw Web Audio**: Tone wraps the Web Audio
  scheduling primitives in a transport-based API. Melopán
  reaches for it because its musical-time scheduling is
  intrinsic; a raw Web Audio implementation would re-derive
  the same primitives.
- **Blender over a JS SVG-to-mesh library**: Blender is the
  reference 3D modeling tool. The CLI runs scripts headless;
  the model fidelity is what would otherwise require
  per-pack-developer time. Keeping the conversion in Python
  with Blender as the runtime is the pattern the team
  invested in.

## Common operations

1. **Add a 3D pack from scratch.** Copy
   `corpan/packs/hover-runner/` as a starting point. Replace
   the manifest id, the build:models pipeline, the asset set,
   and the gameplay code. Keep the dispose discipline.
2. **Rebuild Hover Runner's models.** From the pack directory:
   `npm run build:models` (requires Blender installed and on
   `PATH`). Commit the new GLB.
3. **Add a 2D pack from scratch.** Copy
   `corpan/packs/quest-ear/`. Replace the Phaser scenes; keep
   the SDK plumbing.
4. **Debug a Babylon scene.** Babylon ships an Inspector
   (`scene.debugLayer.show()`). Toggle it from a temporary
   button in the pack during development; remove before ship.
5. **Profile a creative-coding pack's frame.** Chrome / Safari
   DevTools' Performance tab captures the WebGL or Canvas2D
   workload per frame. The audio engines have their own
   audio-render-quantum semantics; the relevant tool is the
   WebAudio tab.
6. **Verify a pack ships on the oldest target iOS.** Section 18
   covers this for audio specifically; the same discipline
   applies to WebGL features (some advanced shaders require
   iOS 16+).

## Why we built it this way

Picking the right engine for each pack is the cost the team is
willing to pay for the experiences each pack is supposed to be.
Forcing every pack into one engine would either over-equip the
2D packs (Babylon for an arcade game) or under-equip the 3D
packs (Phaser for a hover-runner). The HostApi is what makes
the choice scoped to the pack; the engine cost is paid in
bundle size, not in cross-pack coupling.

The Blender-driven SVG-to-GLB pipeline is one of the places the
"plain text travels" principle has to bend. SVG is text; GLB
is binary; the conversion needs Blender. The mitigation is
that the SVG source is committed, the conversion script is
committed, and the GLB output is committed; if Blender's
behavior changes incompatibly, the script is the place to fix
it, not the GLB.

The dispose discipline is a single rule that applies across
every engine: construct on mount, dispose on unmount, nothing
between. The cost (a few lines of explicit teardown per pack)
is invisible; the cost of skipping it (WebGL contexts that
leak, audio voices that double on every reload) is loud.

Creative-coding libraries as opaque to the host is the
extension of the HostApi's "no backdoor" principle (section
12). The host does not know about scene graphs, audio nodes,
or sprite batches. Each pack speaks the small HostApi; the
engine inside the pack is the pack's business. This is the
shape that lets the same Corpán app host a calm audiobook and
a 3D platformer without either having to know about the other.

## To go deeper

- Babylon.js docs at `doc.babylonjs.com`; the "Getting Started"
  page is short.
- Phaser docs at `phaser.io/docs`; the "Making your first game"
  tutorial covers the lifecycle.
- Tone.js docs at `tonejs.github.io`; the "Transport" and
  "Effects" pages cover what Melopán builds on.
- Section 18 for the audio asset format choices that constrain
  what creative-coding packs can bundle.
- The auto-memory notes for the in-flight Melopán and Quest-Ear
  work, which document the per-pack discoveries in more depth
  than this section.

---

# 24. S3

## What it is

S3 is where every asset that does not fit in git lives. The
mastered narration audio from the Spark (section 22). The voice
clone references that feed Chatterbox (section 20). The marketing
assets the App Store and Play Store need. The YouTube captures
(section 25). All of it lives in two AWS S3 buckets in the
`us-east-2` region, fronted by a CloudFront distribution that the
running Corpán app and the encorpora.io site read from.

The two buckets divide responsibility:

- **`corpan-prod`**: the production data plane. Narration pack
  zips and their extracted audio files at the runtime URL
  prefix. Voice references under `sources/voices/data/`. The
  `catalog.json` that lists every published narration. This is
  the bucket the Corpán app fetches from.
- **`corpan-assets`**: the marketing and developer-facing
  assets. App Store and Play Store screenshots and App Previews
  at `marketing/`. Anything that does not need CloudFront-fronted
  delivery to a running app.

The CloudFront distribution at `d38iwc9748jekz.cloudfront.net`
sits in front of `corpan-prod`. The running app and the
encorpora.io site read from CloudFront, not from S3 directly,
so the bucket itself is not load-bearing for runtime reads.

## How it fits

S3 is the durable layer between the producer (Spark, sections 20-22)
and the consumer (Corpán app, encorpora.io, sections 04-15). The
producer writes; the consumer reads; the writes are durable across
machine restarts and across the team. S3 is also one of the four
state locations section 26 walks: anything the pipeline produced
that has not been written here is at risk; anything that lives
here is recoverable.

The Corpán app's runtime story rests on S3 plus CloudFront. When
a user installs a book pack, the app downloads the pack zip from
`https://d38iwc9748jekz.cloudfront.net/.../<narration-id>.zip`,
extracts it, and plays from the embedded audio manifest. When the
user opens the catalog browser inside a reader pack, the catalog
shell fetches `catalog.json` from the same CloudFront origin to
discover what is available. The S3 bucket is the source of truth;
CloudFront is the cache; nothing inside the running app reaches
past CloudFront to S3 directly.

## Files and entry points

### Scripts that push to S3

- `corpan/infra/sync-voices-to-s3.sh`: upload voice references
  from `${HOME}/encorpora/voices/data/*.wav` to
  `s3://corpan-prod/sources/voices/data/`. Uses the
  `corpan-publisher` AWS CLI profile.
- `corpan/infra/sync-marketing-to-s3.sh`: upload marketing
  assets from `${HOME}/encorpora/marketing/` to
  `s3://corpan-assets/marketing/`. Authenticates via an `.env`
  file or `AWS_PROFILE`; sets region `us-east-2`.
- `corpan/infra/captures/sync-captures-to-s3.sh`: upload built
  captures to S3 (section 25 covers captures end to end).
- `corpan/infra/captures/build-and-upload.sh`: build a capture
  variant and (optionally) upload to YouTube; orchestrates the
  capture pipeline with optional `--no-upload` to skip YouTube
  while still letting later S3 sync happen.
- `ttsctl publish` (outside the repo): the narration pipeline's
  own publish step. Zips a pack, uploads the audio files to
  `s3://corpan-prod/...`, invalidates CloudFront, and patches
  `catalog.json`.

### Scripts that pull from S3 / CloudFront

- `corpan/infra/hydrate-audio.sh`: download narration ZIPs from
  CloudFront, extract only the `audio/<lang>/*.m4a` files, and
  place them into the local `books/<category>/<series>/<book>/
  pack/audio/<lang>/` directories. Uses
  `https://d38iwc9748jekz.cloudfront.net/catalog.json` to
  discover which narrations exist and `jq` plus `unzip` to
  filter.
- `corpan/infra/hydrate-voices.sh`: pull voice WAVs from
  `s3://corpan-prod/sources/voices/data/` to local
  `voices/data/`.
- `corpan/infra/hydrate-marketing.sh`: pull marketing assets
  from `s3://corpan-assets/marketing/` to local.
- `corpan/infra/captures/hydrate-captures.sh`: pull captures
  from S3 to local.

### Terraform and supporting docs

- `corpan/infra/terraform/`: the Terraform tree for the cloud
  side. Validated in CI (section 03's `ci.yml`).
- `corpan/infra/PUBLISHING.md`: the runbook for the publishing
  side.
- `corpan/infra/MARKETING_ASSETS.md`: the directory-layout
  convention `sync-marketing-to-s3.sh` expects.
- `corpan/infra/CATALOG_NARRATOR_FIELDS.md`: the schema
  conventions for narrator entries in `catalog.json`.

## How it works

### The bucket layout

`corpan-prod` is the runtime data plane. Its top-level prefixes
(as visible across the scripts and the catalog model) include:

```
s3://corpan-prod/
├── catalog.json                          The published catalog
├── narrations/<book-id>/<lang>/<voice>-<engine>-v<n>.zip
│                                         The narration packs
├── narrations/<book-id>/<lang>/<voice>-<engine>-v<n>/
│   └── audio/<lang>/<segment-id>.m4a     The audio (also in the zip)
└── sources/
    └── voices/
        └── data/
            └── <voice-id>.wav            Voice clone references
```

(The exact path-naming inside `narrations/` is set by `ttsctl
publish`; the rest of the manual references the runtime URL
shape rather than the bucket-internal layout, because the runtime
only sees the CloudFront-fronted URL.)

`corpan-assets` is the developer / store plane:

```
s3://corpan-assets/
└── marketing/
    └── <product>/<store>/<locale>/...    Screenshots, App Previews
```

The two buckets serve different SLAs: `corpan-prod` is the
running app's read path, fronted by CloudFront with aggressive
caching. `corpan-assets` is human-and-CI use, accessed directly
through the AWS CLI without CloudFront in front.

### `catalog.json` and the runtime read path

`catalog.json` is the manifest of every published narration. The
pipeline (`ttsctl publish`) writes it; the running Corpán app and
the catalog shell inside reader packs read it. Per
`NARRATION_SYSTEM.md`:

- Stored at `s3://corpan-prod/catalog.json`.
- Served from CloudFront with
  `Cache-Control: max-age=60, stale-while-revalidate=300`.
- The reader appends a `?_t=<random>` query parameter on every
  catalog fetch to bust the localStorage cache (there is no TTL
  cache on the reader side; the CloudFront cache is the only
  cache).
- Each narration entry carries `bookId`, `language`, `id`,
  `downloadUrl`, version metadata, and the voice/character
  fields that the catalog shell uses to render the narrator
  detail (section 13).

The `downloadUrl` is the CloudFront URL for the narration zip.
The Corpán app's install flow (`content_packs_install_from_url`
in `content_packs.rs`) hits that URL, downloads the zip,
extracts to `{app_data_dir}/corpan-packs/<id>/`, and serves the
content locally through the `corpan-pack://` scheme.

### CloudFront

CloudFront is the CDN in front of `corpan-prod`. The reasons
for its presence are the usual ones: latency and bandwidth. A
user in São Paulo fetching a 50 MB narration zip from
`us-east-2` directly would pay a slow first byte and a long
total transfer; CloudFront's edge in São Paulo serves it from
local cache after the first request from that region.

Practical implications visible elsewhere in the codebase:

- CloudFront invalidation is part of every publish. `ttsctl
  publish` invalidates the catalog path and the published zip
  path; without that, an updated narration would not be
  visible to users until the CloudFront cache expired (up to
  24 hours under default behaviors).
- `hydrate-audio.sh` reads from CloudFront, not from S3,
  precisely so a developer downloading audio reproduces what a
  user would see: same CDN, same cache, same headers.

### Auth

S3 access is per-profile in the AWS CLI:

- `corpan-publisher`: the profile that the voice-sync script
  expects (`--profile corpan-publisher`). Has write access to
  `s3://corpan-prod/sources/voices/data/`.
- The narration publish flow (`ttsctl publish`) uses its own
  credentials set on the Spark.
- The marketing sync script reads from `~/Code/corpora/encorpora/
  .env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) or
  falls through to an exported `AWS_PROFILE`.

The runtime app does **not** authenticate to S3. Reads go
through CloudFront over plain HTTPS; the catalog and the
narration zips are public.

### The producer-consumer choreography

End to end, the path of a freshly-rendered narration:

```
[Spark: ttsctl runs Chatterbox + Whisper + ffmpeg per segment]
                  |
[Spark: ttsctl publish builds <narration>.zip]
                  |
[aws s3 cp <zip> s3://corpan-prod/narrations/.../<narration>.zip]
                  |
[aws s3 cp <audio>/* s3://corpan-prod/narrations/.../audio/<lang>/]
                  |
[catalog.json updated to include the new entry; aws s3 cp]
                  |
[aws cloudfront create-invalidation /catalog.json /narrations/...]
                  |
[Reader app: GET /catalog.json?_t=<random>
                  -> receives new entry
                  -> renders new entry in library]
                  |
[User taps install:
   Reader app: GET /narrations/.../<narration>.zip
                  -> downloads to app data dir
                  -> unzips
                  -> reads segments.json + audio_manifest_<lang>.json
                  -> plays audio via corpan-pack://]
```

Two production-critical invariants live in this choreography:

1. **The catalog patch is the last write.** Audio first, zip
   second, catalog third. A reader that sees a catalog entry
   for a narration whose zip is not yet uploaded would 404 on
   install; doing it in order avoids that race.
2. **CloudFront invalidation is part of the publish.** A new
   `catalog.json` whose CloudFront cache is stale is the same
   as no publish at all; the invalidation is what crosses the
   write into the user-visible world.

### Hydration as the dev-loop primitive

`hydrate-audio.sh` is what makes audio-bearing local development
viable. After a fresh clone (and `git lfs pull`), the
`books/<category>/<series>/<book>/pack/audio/` directories are
empty (`.gitignore`d). Running the hydrator pulls the audio for
every book listed in the catalog and lays it out where the
reader pack's Vite dev server expects to find it.

The hydrator's filters (`--book`, `--lang`) make partial
hydration cheap. A developer working on the Hebrew narration of
Genesis hydrates only that pair; the entire catalog is a few
gigabytes and a few hundred files, which most developers do not
need at any given moment.

`hydrate-voices.sh` plays the same role for voice WAVs;
`hydrate-marketing.sh` for marketing assets. Each is its own
script because each pulls from a different bucket / prefix and
each has different filter semantics.

### Cost shape

A rough mental model:

- **Storage** is cheap. The full Fascinating Curiosities run
  (~7.5 GB of M4A) is on the order of tens of cents per month at
  S3 Standard prices.
- **Egress** is the cost driver. CloudFront's per-GB egress
  pricing is what dominates the monthly bill at scale. The
  per-zip download is on the order of MB to tens of MB; the
  per-pack audio stream after install is what the budget
  watches.
- **Requests** are negligible. The catalog read is a small
  number of bytes; the narration installs are large but
  infrequent (once per user per language).

The pipeline's choice to ship M4A at 64 kbps (section 18) is in
part a cost choice: doubling the bitrate would double the
egress.

## Common operations

1. **Publish a new narration.** Run `ttsctl publish` from the
   Spark. The tool handles the S3 upload, the catalog patch,
   and the CloudFront invalidation. Verify on encorpora.io that
   the new narration appears in the catalog.
2. **Sync a new voice reference.** Drop the WAV into
   `voices/data/<voice-id>.wav` on a laptop, run
   `./corpan/infra/sync-voices-to-s3.sh`. Confirm with `aws s3
   ls s3://corpan-prod/sources/voices/data/`.
3. **Hydrate the audio for one book locally.**
   `./corpan/infra/hydrate-audio.sh --book book_genesis`.
   Run the reader pack's `npm run dev`; the audio resolves.
4. **Publish marketing assets.** Lay the screenshots out per
   `MARKETING_ASSETS.md`, run
   `./corpan/infra/sync-marketing-to-s3.sh`. Store-side review
   teams pull from the bucket directly.
5. **Inspect what is in the catalog.**
   `curl -s https://d38iwc9748jekz.cloudfront.net/catalog.json |
   jq '.narrations[] | {bookId, language, id, version}'`.
6. **Force a stale CloudFront cache.**
   `aws cloudfront create-invalidation --distribution-id <id>
   --paths "/catalog.json" "/narrations/<book-id>/*"`. Required
   if a publish skipped its invalidation step.

## Why we built it this way

S3 plus CloudFront is the boring infrastructure that solves the
size and distribution problem without surprises. Audio is too
large for git and for direct binary distribution; the catalog
needs to be edge-cached for app responsiveness on first open;
new narrations have to land in users' libraries within minutes
of publish. Every alternative we have considered (Backblaze B2
plus Bunny CDN, R2 plus Cloudflare, GitHub Releases) brought
some advantage and some risk. The S3 plus CloudFront combination
is the one with the fewest unknowns at our scale.

Two buckets instead of one is the smallest separation that
matches the access patterns. Marketing assets do not need
CloudFront fronting; runtime narrations do. Putting both in one
bucket would force decisions (which CloudFront origin, which
caching behavior) that come naturally when the two are
separated.

The catalog as a single JSON file fronted by a short-lived
CloudFront cache is the smallest publish surface. There is no
search API; there is no database query at runtime. The catalog
is a static artifact the publish step writes and the app reads.
The `?_t=` cache-buster on the app side and the
`stale-while-revalidate=300` on the CloudFront side together
make this fast and fresh enough.

Per-script hydration into local dev directories is the small
piece of tooling that makes the producer-consumer split feel
hospitable. A developer who has never touched the pipeline can
hydrate the catalog into their local checkout and run the
reader pack against real audio in minutes. Without the
hydrators, the same task would mean either re-rendering on the
Spark (overkill) or downloading the entire catalog as a single
opaque tarball (wasteful).

CloudFront invalidation as part of every publish is the
discipline that keeps "I just published" and "the user can
install it" aligned. The cost (a few cents per invalidation
batch) is dwarfed by the cost of confusion if it were
optional.

## To go deeper

- `corpan/infra/PUBLISHING.md` for the canonical publish
  runbook.
- `corpan/infra/CATALOG_NARRATOR_FIELDS.md` for the
  `catalog.json` schema specifics.
- `corpan/infra/MARKETING_ASSETS.md` for the marketing bucket's
  directory conventions.
- `corpan/infra/terraform/` for the cloud-side declarative
  config; CI (`ci.yml`) runs `terraform fmt` and `terraform
  validate` against it on every PR that touches it.
- AWS's docs on S3 (`docs.aws.amazon.com/s3/`) and CloudFront
  (`docs.aws.amazon.com/cloudfront/`). Section 26 maps this
  bucket layout into the larger state-locations picture.

---

# 25. Captures and YouTube

## What it is

Captures are the short marketing videos that go to the Corpán
YouTube channel (`@corpán1`) and to Google Ads. Each capture is
born as an iPad screen recording of the app in use, runs through
a fixed ffmpeg pipeline that produces four delivery variants
(long, shorts, square, thumb), and optionally uploads to YouTube
through a small Python CLI. The whole pipeline lives at
`corpan/infra/captures/`.

This is distinct from the marketing assets in section 24's
`s3://corpan-assets/marketing/` (which are App Store and Play
Store screenshots and 15-30 second App Previews). Captures are
60-180 second videos for the YouTube channel and for paid Google
Ads creatives.

## How it fits

Captures are the producer end of the marketing loop. The
pipeline is offline (a developer or marketer kicks it off from a
laptop); the artifacts go to `s3://corpan-assets/captures/` and
(for the long form) directly to YouTube through the `corpan-yt`
CLI. The consumer side is YouTube viewers and Google Ads
audiences; neither lives in the running Corpán app.

The same shape as the narration pipeline (sections 18, 20-22):
producer-consumer split, files on disk as the contract,
hydration scripts to round-trip between local and S3. The
captures pipeline reuses the same auth pattern
(`~/Code/corpora/encorpora/.env` for AWS credentials).

## Files and entry points

- `corpan/infra/captures/CAPTURES.md`: the canonical doc.
  Layout, sidecar format, the YouTube field mapping.
- `corpan/infra/captures/build-capture.sh`: build one raw `.mov`
  into the four variants (long.mp4, shorts.mp4, square.mp4,
  thumb.jpg) plus a `meta.json` manifest.
- `corpan/infra/captures/build-and-upload.sh`: wrapper around
  `build-capture.sh` that follows up with `corpan-yt upload`.
  Supports `--no-upload` to skip the upload (useful when the
  YouTube `videos.insert` quota is exhausted for the day).
- `corpan/infra/captures/sync-captures-to-s3.sh`: push local
  captures (raw + built) to `s3://corpan-assets/captures/`.
- `corpan/infra/captures/hydrate-captures.sh`: pull captures
  back from S3 to local.
- `corpan/infra/captures/trim-deadair.py`: Python script that
  trims silence from raw captures before the ffmpeg pipeline.
- `corpan/infra/captures/mix-bgm.py`: Python script that mixes
  background music under a built variant.
- `corpan/infra/captures/branding/`: channel-level assets
  (avatar, banner, watermark, localized strings in
  `localizations.json`).
- `corpan/infra/captures/youtube/`: the Python CLI.
  - `pyproject.toml` declares `corpan-yt` as the script entry,
    dependencies `google-api-python-client`,
    `google-auth-oauthlib`, `google-auth-httplib2`, and
    `click`.
  - `corpan_yt/cli.py` is the click-based CLI.

## How it works

### The capture lifecycle

End to end, a single capture goes through:

```
[iPad screen recording -> ~/Desktop/Corpan Captures/raw/YYYY-MM-DD/<slug>.mov]
                |
[Hand-edit <slug>.meta.json sidecar: title, description, tags, languages]
                |
[./build-capture.sh <raw.mov>]
                |
[ffmpeg produces four variants in built/YYYY-MM-DD/<slug>/:
    long.mp4    1200x1600 vertical, cleaned for YouTube
    shorts.mp4  1080x1920 (9:16), blur-padded, <=180 s
    square.mp4  1080x1080 (1:1), blur-padded
    thumb.jpg   1280x720 thumbnail, blur-padded ]
                |
[./sync-captures-to-s3.sh  (raw + built mirrored to S3)]
                |
[corpan-yt upload <built-dir>  (long variant -> YouTube)]
                |
[Google Ads pulls from the S3 captures/ tree for paid creatives]
```

`build-and-upload.sh` is the convenience wrapper that bundles
the build, sync, and upload into one call.

### The four delivery variants

The pipeline's defining choice is to produce four variants from
one raw capture instead of asking the marketer to build them
separately. Each variant has its own use:

- **long.mp4**: the main YouTube upload. 1200x1600 vertical,
  color-converted from the iPad's `yuvj420p` full-range to
  YouTube-friendly `yuv420p` limited range so it does not look
  washed out.
- **shorts.mp4**: YouTube Shorts, capped at 180 seconds, 9:16
  with the source video centered and a Gaussian-blurred copy
  filling the side bars.
- **square.mp4**: 1:1 aspect for Instagram and certain Google
  Ads slots. Same blur-pad technique, with an option for
  `SQUARE_BG=solid` and `SQUARE_BG_COLOR=0x252525` when the
  source is a dark UI and the blur looks muddy.
- **thumb.jpg**: 1280x720 16:9 thumbnail with the same
  blur-pad technique. The first frame of the long variant or a
  chosen poster frame, depending on the sidecar.

The colour-space normalization step is the kind of detail the
pipeline encodes for everyone's benefit. iPad screen recordings
come out as `yuvj420p` (JPEG full-range) tagged BT.709. Every
encode in this pipeline converts to `yuv420p` limited-range so
the result looks correct on YouTube and on Safari; without the
conversion, the colors are washed out on every platform that
respects the metadata.

### The sidecar

Each raw `.mov` lives next to a `<slug>.meta.json` sidecar that
the marketer hand-edits. The sidecar drives the YouTube fields:
title, description, tags, primary language, secondary languages
spoken in the video, visibility (public, unlisted, private),
playlist memberships, category. The build script copies the
sidecar into the built directory's `meta.json` along with build-
time fields it adds automatically (dimensions, durations,
codec).

If the sidecar is missing, `build-capture.sh` writes a stub and
exits non-zero. The first run of a new capture is therefore "the
script writes a stub, the marketer fills in the fields, the
marketer re-runs." This is the smallest workflow that makes the
sidecar mandatory without making it tedious.

### Naming

The slug format encodes scene plus country plus languages
captured in the video:

```
main-exp-algeria_ar-en-fr-tr-es-zh
pack-discovery-morocco_ar-fr
```

`kebab-case` for the scene and country, joined with `-`; an
underscore separates the human-meta from the language list;
ISO 639-1 language codes joined with `-`. The build script does
not enforce the format, but consistent naming makes the S3
captures tree grep-able for "every capture with Arabic" or
"every Morocco capture."

### S3 layout

The bucket layout mirrors the local layout:

```
s3://corpan-assets/captures/
├── raw/YYYY-MM-DD/<slug>.mov
├── raw/YYYY-MM-DD/<slug>.meta.json
└── built/YYYY-MM-DD/<slug>/{long,shorts,square}.mp4
                          /thumb.jpg
                          /meta.json
```

`sync-captures-to-s3.sh` is the up-sync; `hydrate-captures.sh`
is the down-sync. Both use the same AWS credentials pattern
(`~/Code/corpora/encorpora/.env` or `AWS_PROFILE`).

### The YouTube CLI

`corpan-yt` is a Python click CLI that wraps Google's YouTube
Data API v3. Its commands cover the lifecycle of a YouTube
video: `upload`, `update`, `set-thumbnail`, `add-to-playlist`,
and the auth handshake (`auth-init` / `auth-refresh`).

Dependencies are minimal: `google-api-python-client` for the
API client, `google-auth-oauthlib` for the OAuth flow,
`click` for the CLI scaffolding. Auth tokens are stored on
disk; the OAuth flow runs once per workstation.

`videos.insert` (the underlying API call for `upload`) has a
daily quota; when it is exhausted, the CLI returns a clear
error and `build-and-upload.sh` skips the upload step but still
completes the build and the S3 sync. The next-day rerun picks
up the upload.

### Channel-level branding

The `branding/` subdirectory holds the channel-level assets:
`channel-avatar.png`, `channel-banner.jpg`, two watermark
variants. `localizations.json` carries the per-locale channel
title and description. These do not change per capture; they
change a few times a year, set through the YouTube web UI or
through the CLI's channel-level commands.

## Common operations

1. **Build a single capture.** Drop the iPad recording into
   `~/Desktop/Corpan Captures/raw/YYYY-MM-DD/<slug>.mov`. Run
   `./corpan/infra/captures/build-capture.sh <path-to-mov>`.
   Fill in the sidecar when it errors out, rerun.
2. **Build and upload in one step.**
   `./corpan/infra/captures/build-and-upload.sh <raw.mov>`.
   `--no-upload` to skip the YouTube upload but still produce
   the variants.
3. **Push captures to S3.**
   `./corpan/infra/captures/sync-captures-to-s3.sh`. Idempotent;
   re-runs are cheap.
4. **Re-encode a single variant.**
   `./corpan/infra/captures/build-capture.sh <raw.mov> --variants shorts`.
   The other variants are not rebuilt.
5. **Tune the square variant for a dark UI scene.** Set
   `SQUARE_BG=solid` and (optionally)
   `SQUARE_BG_COLOR=0x252525` in the environment before calling
   `build-capture.sh`.
6. **Re-upload an already-built capture.**
   `corpan-yt upload <built-dir>`. The CLI is idempotent on
   identity; it errors if the video already has a YouTube id
   recorded in the meta.json.

## Why we built it this way

Four variants from one source is the choice that respects the
marketer's time. The Shorts vertical, the YouTube long form,
the square Instagram cut, and the thumbnail are all derivable
from the same source by fixed transforms; building them by
hand four times would mean four chances to introduce a quality
drift between them. The pipeline produces the same set every
time.

The blur-pad technique for the side bars is the small
production-value choice that distinguishes the captures from
the typical "letter-boxed iPad recording" look. The cost is one
extra ffmpeg filter; the visual difference is obvious.

The `yuvj420p` to `yuv420p` color normalization is the kind of
detail that earns the comment in the script. The first
captures that went up without the conversion looked washed out
on Safari and on the YouTube watch page, even though they
looked fine in QuickTime; documenting the conversion in the
script's header means the next capture pipeline maintainer
does not have to rediscover the cause.

The sidecar-as-mandatory step is the smallest discipline that
keeps YouTube metadata honest. The pipeline could auto-derive a
title from the slug, but the slug is for organization, not for
viewers; making the marketer fill in the title is what keeps
the channel listings coherent.

The Python CLI instead of the YouTube web UI is the choice
that makes uploads scriptable. A multi-language capture run
produces several variants per video and several videos per
session; clicking through the YouTube UI for each is the kind
of repetitive work that breeds mistakes. `corpan-yt` is a few
hundred lines of Python that absorbs the repetition.

## To go deeper

- `corpan/infra/captures/CAPTURES.md` end to end. The
  authoritative doc.
- The YouTube Data API v3 docs at
  `developers.google.com/youtube/v3` for the underlying API
  the CLI calls.
- `corpan/infra/captures/youtube/corpan_yt/cli.py` for the
  click command tree.
- Section 24 for the S3 / CloudFront layout the captures bucket
  shares; section 18 for the audio-side discipline that the
  captures pipeline's color-space discipline mirrors.

---

# 26. State Locations

## What it is

The project's state lives in four locations, and a fifth if you
count GitHub. Each is durable to a different audience. Each is
written by a different mechanism. None is authoritative for what
the others hold. The four:

1. **The repo (and its remotes on GitHub).** Source code,
   manifests, configs, books authored in markdown, the small
   metadata files. Tracked in git; LFS for sqlite and image and
   pdf and epub files. The encorpora repo at `corpora-inc/
   encorpora` is the canonical source; Jeff's fork at
   `Umanistan/encorpora` is the working copy; this checkout is a
   worktree off the fork (section 03).
2. **The Spark.** Working narration jobs in flight, the
   `~/projects/ttsctl/` pipeline tool, the per-decision
   changelog under `~/projects/ttsctl/changelog/decisions/`, the
   model caches, the intermediate WAVs the pipeline produces
   before mastering. Accessed over Tailscale (section 22).
3. **S3 and CloudFront.** The published narration audio and
   zips, the voice clone references, the marketing assets, the
   captures. Two buckets (`corpan-prod`, `corpan-assets`) in
   `us-east-2`. CloudFront at `d38iwc9748jekz.cloudfront.net`
   fronts `corpan-prod` (section 24).
4. **The user's device.** The Corpán app's settings store, the
   phrase history, the installed packs, the per-pack book
   metadata cache, the user's preferences. Stored in the app's
   data directory and in the WebView's `localStorage`.

There is also a small set of out-of-band state that does not fit
the four-bucket model: Jeff's `~/Desktop/corpan-voice-clones/`
working copies (mirrors of the S3 voice references), Skylar's
`~/encorpora/` working copies of the narration pipeline state,
and any teammate's local agent memory at
`~/.claude/projects/.../memory/`. These are personal scratch
spaces, not project state; section 33 covers their role.

## How it fits

This is the synthesis section. Sections 02 (Monorepo), 03 (Version
Control), 22 (Spark), 24 (S3), and most of the platform sections
each touch one or two locations directly; this one is the map of
how they relate. The mental model the Codex tries to give the
reader is: when you make a change, which location does it land in,
how does it get to the others, and where could it be lost.

The first answer is that none of the four locations syncs all the
state automatically. They synchronize at named seams:

- **Repo ↔ Spark**: by `git push`/`git pull` against `origin` and
  `upstream`. The Spark has its own clone of the repo. `rsync`
  over the tailnet is the alternate path for files (`books/.../
  pack/`) the pipeline needs but that are not yet committed.
- **Spark ↔ S3**: by `ttsctl publish` (the narration pipeline's
  own publish step) and the `corpan/infra/sync-*-to-s3.sh`
  scripts. One direction; the Spark does not pull from S3 at
  pipeline runtime.
- **Repo ↔ S3**: by the `corpan/infra/sync-*-to-s3.sh` and
  `corpan/infra/hydrate-*.sh` script families, run from a laptop
  or from the Spark. These are bi-directional but per-asset-
  class (voices, audio, marketing, captures).
- **S3 ↔ Device**: by the running Corpán app, fetching from
  CloudFront. One direction; the device does not write back to
  S3.
- **Device ↔ Repo**: only through the developer at the keyboard.
  There is no device-to-cloud sync of user state today.

## Files and entry points

### Repo

- `.git/`: the repository itself. Local clone of the fork at
  `Umanistan/encorpora`; the team repo `corpora-inc/encorpora`
  is the `upstream` remote (section 03).
- `.gitattributes`: declares which extensions are LFS-tracked
  (`*.sqlite3`, `*.png`, `*.epub`, `*.pdf`).
- `.gitignore`: declares which directories are non-state
  (`node_modules/`, `target/`, build outputs, hydrated audio,
  voice WAVs).
- `corpan/dja/db.sqlite3` and `corpan/dja/release.sqlite3`: the
  phrase corpus's authoring and release databases (section 16).
  In git via LFS.
- `books/<category>/<series>/<book>/`: per-book source markdown,
  `segments.json`, `audio_manifest_<lang>.json`. Audio files
  themselves are `.gitignore`d.

### Spark

- `~/projects/ttsctl/`: the pipeline tool (section 22).
- `~/projects/ttsctl/changelog/decisions/`: the dated per-
  discovery decision logs.
- `~/encorpora/`: the Spark's own clone of the repo.
- Per-pack working directories where the pipeline accumulates
  intermediate WAVs.
- The Hugging Face model cache.

### S3 and CloudFront

- `s3://corpan-prod/catalog.json` and the published narration
  zips and audio (section 24).
- `s3://corpan-prod/sources/voices/data/`: voice clone WAVs.
- `s3://corpan-assets/marketing/`: store assets.
- `https://d38iwc9748jekz.cloudfront.net/`: the CDN-fronted read
  path the running app uses.

### Device

- `{app_data_dir}/release.sqlite3`: the phrase corpus, written
  out from the embedded constant on first launch (section 16).
- `{app_data_dir}/corpan-packs/<pack-id>/`: installed packs
  (manifest plus dist plus optional bundled SQLite). Created by
  the host's content-packs install flow (section 10).
- WebView `localStorage`: every Zustand store the app and the
  packs use (sections 06, 14).
- iOS / Android `UserDefaults` / `SharedPreferences` for plugin-
  level state.
- The OS-managed in-app-purchase ledger (Apple receipt, Google
  acknowledgment), authoritative on the device for subscription
  status.

## How it works

### The full diagram

```
                        ┌──────────────────────┐
                        │  GitHub (upstream    │
                        │  corpora-inc/        │
                        │  encorpora)          │
                        └──────────▲──────┬────┘
                                   │      │
                                   │ PR   │ release builds
                                   │      │
              ┌────────────────────┴──┐   │
              │  GitHub (origin       │   │
              │  Umanistan/encorpora) │   │
              └─────────▲─────┬──────┘    │
                        │     │           │
                  push/ │     │ fetch     │
                  pull  │     │ pull      │
                        │     │           │
                ┌───────┴─────▼────┐  ┌───┴────────────┐
                │  Laptop          │  │  App Store /   │
                │  (worktrees:     │  │  Play Store /  │
                │   encorpora,     │  │  Desktop bin   │
                │   encorpora-ear, │  └────────────────┘
                │   corpora-codex) │
                └────┬──────┬──────┘
                     │      │
            ssh /    │      │ AWS CLI
            rsync    │      │
                     │      │
              ┌──────▼──┐ ┌─▼───────────┐
              │  Spark  │ │  S3         │
              │  (GB10) │ │  corpan-prod│ ◄────┐
              │         │ │  corpan-asse│      │
              └────┬────┘ └─┬───────────┘      │
                   │        │                  │
        ttsctl     │        │ CloudFront       │
        publish    │        │ d38iwc9748jekz   │
        ───────────┴────────▼──────────────────┤
                                               │
                                               │
                                          ┌────▼────────┐
                                          │ User device │
                                          │ (iOS,       │
                                          │  Android,   │
                                          │  desktop)   │
                                          └─────────────┘
                                                ▲
                                                │
                                          Local writes:
                                          - app data dir
                                          - localStorage
                                          - OS keychain (IAP)
```

(ASCII art is approximate; the relationships are exact.)

### The seams in detail

**Repo to Spark.** The Spark has its own checkout of the repo,
under `~/encorpora/`, on whichever branch the current pipeline
job needs. Updating the Spark's checkout is the same as any
other clone: `git fetch upstream && git checkout main && git
merge --ff-only upstream/main`. For an in-flight book that has
not yet been committed (an experiment, a one-off render of a
WIP manuscript), `rsync` over the tailnet pushes from a laptop
directly: `rsync -avz books/.../pack/ spark:~/encorpora/books/
.../pack/`.

The reverse direction (pulling Spark-side files back to a laptop
or committing them upstream) is rarer. Pipeline-produced audio
goes to S3, not into git. Pipeline-produced audio manifests do
get committed to the repo (they live under `books/.../pack/
audio_manifest_<lang>.json`, not `.gitignore`d); the Spark
generates them and `rsync` or commit-and-push brings them back.

**Spark to S3.** `ttsctl publish` is the canonical write path
for narrations. The pipeline runs locally on the Spark, then
uploads the audio files, the zip, and the catalog patch to
`s3://corpan-prod/`, then invalidates CloudFront. The other
sync scripts (`sync-voices-to-s3.sh`, `sync-marketing-to-s3.sh`)
run from a laptop, not from the Spark, because the assets they
push are authored on a laptop (the voice WAVs come from a mic,
the marketing assets come from the design pipeline). The
captures sync runs from wherever the capture is built (usually
a laptop).

**Repo to S3.** Only through the scripts. The `infra/sync-*-to
-s3.sh` family is the write side; the `infra/hydrate-*.sh`
family is the read side. Both run by hand against the local
repo's directory layout (`voices/data/`, `marketing/`, the per-
book `pack/audio/` directories) and the corresponding S3 prefix.

**S3 to device.** Only through the Corpán app. The app reads
`catalog.json`, surfaces narrations in the catalog browser, and
downloads the relevant zip on install. There is no other path
from S3 to the device, by design.

**Device-side state.** The user's settings, history, ratings,
installed phrase packs, and per-pack book metadata cache all
live on the device. Per section 14:

- Host Zustand stores in `corpan-app/src/store/` are persisted to
  the WebView's `localStorage`.
- Pack-side factory stores (`bookMetaStore`, `bookmarkStore`,
  `prefsStore`) write to `localStorage` with per-pack key
  prefixes.
- Pack-side singleton stores (`narrationHistoryStore`,
  `drawerStore`) write to `localStorage` with cross-pack keys.
- Catalog `libraryStore` (installed narrations) writes to
  `localStorage`.
- The OS's IAP ledger is authoritative for subscription status
  and individual product purchases; the app reads it through
  `tauri-plugin-iap` and the platform-native subscription
  plugin.

**Device-to-anywhere sync.** There is none today. A user's
settings, library, and history do not leave their device. This is
both a deliberate simplification (no backend, no auth, no PII to
custodian) and a known limitation (users with two devices have
two separate libraries). Section 35 discusses what the near
future might add.

### What synchronizes on a publish

When Skylar runs `ttsctl publish` on the Spark, several places
get touched in this order:

1. Spark's local file system: the zip is built; the audio files
   are staged.
2. `s3://corpan-prod/narrations/...`: audio files uploaded.
3. `s3://corpan-prod/narrations/<...>.zip`: the zip uploaded.
4. `s3://corpan-prod/catalog.json`: the catalog patched and
   re-uploaded.
5. CloudFront: invalidation for `/catalog.json` and the
   `/narrations/...` prefix.
6. Every running Corpán app, eventually: on next catalog fetch
   (which is on app open or on user-triggered refresh), the new
   narration appears in the library.

The user's device-side state is **not** touched by a publish.
Existing installs of the same narration continue to play
locally; the user has to install the new version explicitly. The
catalog tells the user a new version exists; the install
decision is theirs.

### What synchronizes on a code change

When Jeff lands a PR to the app or a pack:

1. The PR is merged into `upstream/main`.
2. CI builds the app and the web/io site (section 03).
3. The Pages workflow rebuilds and redeploys encorpora.io.
4. For a binary release, Jeff bumps the app's
   `version` in `package.json`, `Cargo.toml`, and
   `tauri.conf.json`, runs `npm run tauri build` for each
   platform, and submits to the App Store / Play Store
   (sections 27, 28).
5. App Store and Play Store review, then publish.
6. Users update from their store.
7. On first launch of the new version, `DbState::new` notices
   the bundled `release.sqlite3` size has changed and rewrites
   the on-device copy (section 16).

The user's device-side stores (history, settings, installed
packs) are preserved across the update; the corpus is replaced;
the binary is replaced.

### What does not synchronize

- Spark-only state: the pipeline tool, the decision logs, the
  intermediate WAVs, the model cache. None of this is in S3, in
  the repo, or on a user's device. Losing the Spark would lose
  it; the durable parts (the published audio, the audio
  manifests, the per-narration changelogs) are mirrored
  elsewhere, but the tool itself and the in-flight working
  state would have to be reconstructed.
- The user's device-side state. No backup, no cloud sync, no
  account-level identity for the running app.
- Voice clone WAVs as edited on a laptop, until the sync script
  has been run.
- A capture as edited on a laptop, until the capture sync /
  upload has been run.

Each of these has a remediation plan if it is lost (rebuild the
pipeline from `ttsctl`'s git history, accept the lost device
state and re-onboard, re-record the voice WAV, re-build the
capture) but the remediation is real work. The state-location
map is partly an inventory of what we can afford to lose.

## Common operations

1. **Check what is in flight on the Spark.** `ssh spark`,
   `cat ~/projects/ttsctl/state.json` or whichever current
   pipeline-state file `ttsctl` is using. The Spark-side
   `PIPELINE_STATE.md` (and the same name at the encorpora repo
   root) summarizes.
2. **Find where a single file lives.** A pack manifest lives
   in the repo. A pack zip lives on S3 (and on CloudFront).
   The audio inside lives on S3 (and on the user's device after
   install). A book's source markdown lives in the repo. A
   user's setting lives only on their device.
3. **Recover a lost narration.** If a publish was wrong, the
   Spark's working directory has the intermediate WAVs; the
   `ttsctl publish` step can be rerun. If a publish was
   correct but the catalog entry is wrong, edit `catalog.json`
   on the Spark and re-upload (section 24's invalidation step
   is required).
4. **Recover a lost voice WAV.**
   `./corpan/infra/hydrate-voices.sh` from a fresh laptop
   pulls the durable copy from S3 into `voices/data/`.
5. **Recover a lost dev-side audio file.**
   `./corpan/infra/hydrate-audio.sh --book <book-id>` from a
   fresh laptop pulls from CloudFront.
6. **Inspect the user-device-side state of a Corpán install.**
   Open the in-app dev tools (Safari Web Inspector for iOS, the
   debug-port chrome:// for Android), navigate to Storage,
   inspect `localStorage`. The host's keys (`settings`, etc.)
   and the per-pack keys (`<pack-id>:bookMeta:...`, etc.) are
   all readable.

## Why we built it this way

The four-location model is what happens when you take "do the
smallest thing that works" seriously across four very different
audiences. The repo is the developer's truth; the Spark is the
producer's truth; S3 is the distribution truth; the device is
the user's truth. Each is exactly the storage shape that fits
its audience, and the seams between them are the named scripts.

Not syncing device state to a cloud is a deliberate simplification.
The cost (a second-device user starts from scratch) is real but
small; the alternative (a backend, accounts, sync conflicts,
GDPR custody of per-user data) is structurally much larger. The
day the second-device cost becomes large enough is the day to
revisit it. Section 35 names that as a near-future possibility.

The Spark as a separate state location, not as "the repo plus a
GPU," is the choice that respects what the pipeline actually
does. The pipeline is a long-running stateful program with its
own in-flight artifacts; making it a first-class state location
in the manual is more honest than pretending its state is just
"some directories under `corpan/`."

Hydration scripts as the round-trip primitive is the smallest
discipline that makes the producer-consumer split feel like
"one project." A developer can be confident that after a fresh
clone plus `git lfs pull` plus
`./corpan/infra/hydrate-{voices,audio,marketing}.sh`, the
repo's tree is a faithful working copy of the project's state.
That property is what lets sections 02 and 24 promise the
monorepo experience without secretly assuming the developer has
been at it for years.

The publish-time CloudFront invalidation as the moment the
user's view of the world updates is the small ritual that ties
the catalog write to the user-visible state. Without it, S3
would be the truth but the user would see CloudFront's older
cache; the seam between them would be silent. Making the
invalidation a required step of the publish is what makes the
seam loud.

## To go deeper

- Section 03 for the git remotes; section 22 for the Spark;
  section 24 for S3 and CloudFront; sections 27 and 28 for the
  platform stores.
- `corpan/NARRATION_SYSTEM.md` for the producer-side state.
- `PIPELINE_STATE.md` at the repo root for the latest dated
  snapshot.
- `corpan/CHANGELOGS.md` for the per-shippable-unit discipline
  that keeps the repo-side state honest.
- The auto-memory at
  `~/.claude/projects/-Users-jeffryeverett-Code-encorpora/memory/`
  for the agent-side state that lives between conversations
  with this codebase.

---

# 27. iOS

## What it is

iOS is the largest target Corpán ships to by user count, and the
target that has driven the most platform-specific work in the
codebase. The app's bundle id is `com.corpora.corpan`, the
development team is `F9AV5HKF6N` (Corpora Inc), the minimum
deployment target is iOS 16.0, and the app is built through
Tauri's iOS path (section 04) which compiles the Rust binary to a
static library, links it into an Xcode project, and produces a
signed `.ipa` for App Store submission.

The Tauri iOS integration is generated. The source of truth for
the Xcode project is `corpan-app/src-tauri/ios/project.yml`, an
XcodeGen file that the regen script (`scripts/ios-gen.sh`) plays
into `gen/apple/` on every build. Hand-edits to the generated
project are overwritten; everything platform-specific lives in
the template.

## How it fits

iOS sits at the same Tauri seam as every other platform (section
04). Above it: the React tree, the packs, the catalog. Below it:
the Swift native plugins that wrap the platform APIs (STT, TTS,
IAP, audio keepalive, radio streaming, subscriptions). The
plugins themselves are shared with Android by Cargo path
(section 05's path-deps) and only diverge in their `ios/` and
`android/` subdirectories.

The user-facing surface is everything inside the WebView plus a
handful of OS integrations the WebView cannot do itself: the
lock screen Now Playing UI, AirPods hardware controls, Bluetooth
remote controls, system TTS voices, microphone access for the
pronunciation coach, in-app purchase flows, and the Apple
Feedback Assistant deep link (section 04's
`open_apple_feedback` command).

## Files and entry points

- `corpan/corpan-app/src-tauri/tauri.conf.json`: the iOS section
  pins `minimumSystemVersion: "16.0"`, the development team
  (`F9AV5HKF6N`), and the project template path
  (`src-tauri/ios/project.yml`).
- `corpan/corpan-app/src-tauri/ios/project.yml`: the XcodeGen
  definition. Bundle prefix `com.corpora.corpan`, deployment
  target 16.0, source paths into `Sources`, `Externals`,
  `corpan_iOS`, `assets`, `LaunchScreen.storyboard`, and
  `Corpan.storekit`.
- `corpan/corpan-app/src-tauri/ios/Corpan.storekit`: the StoreKit
  test configuration. Drives in-app purchase testing in
  Simulator and on TestFlight before the products are live on
  App Store Connect.
- `corpan/corpan-app/src-tauri/ios/ExportOptions.plist`: the
  Xcode `xcodebuild -exportArchive` settings (signing style,
  team id, upload symbols).
- `corpan/corpan-app/src-tauri/ios/corpan_iOS/`: the iOS-specific
  template files (`Info.plist`, `corpan_iOS.entitlements`,
  `PrivacyInfo.xcprivacy`, `LaunchScreen.storyboard`, app
  icons).
- `corpan/corpan-app/scripts/ios-gen.sh`: the regen script.
  Cleans `gen/apple/`, pre-copies template files, runs
  `npx tauri ios init --ci`, verifies `LD_RUNPATH_SEARCH_PATHS`
  includes `/usr/lib/swift`, and patches the StoreKit scheme
  reference XcodeGen misses.
- `corpan/corpan-app/src-tauri/gen/apple/`: the generated
  Xcode project. **Do not edit.** `ios-gen.sh` rewrites it.
- `corpan/plugins/tauri-plugin-*/ios/`: the Swift sources for
  each plugin's iOS half (section 05). The STT plugin lives at
  `corpan/plugins/tauri-plugin-stt/ios/Sources/`.
- `corpan/corpan-app/test_feedback_app.swift`,
  `test_ns_voices.swift`, `test_voices.swift`: standalone Swift
  scratch files used to probe the iOS Feedback Assistant URL
  schemes and the available TTS voice list during development.
- `corpan/APP_RELEASE_0_11_3.md`: the punch-list-style runbook
  for the iOS half of a release.

## How it works

### The regen path

The iOS Xcode project is **not** committed in a hand-edited state.
Instead, `ios-gen.sh` rebuilds `gen/apple/` from
`src-tauri/ios/project.yml` and the template files. The flow:

1. `./scripts/ios-gen.sh --clean` wipes `gen/apple/`.
2. The script pre-copies `Corpan.storekit` and
   `corpan_iOS.entitlements` from the template directory into
   the to-be-generated location, so XcodeGen sees them as
   sources to include.
3. `npx tauri ios init --ci` runs, which invokes XcodeGen
   against `project.yml`. The result is a complete Xcode
   project in `gen/apple/`.
4. The script verifies that the generated build settings
   include `/usr/lib/swift` in `LD_RUNPATH_SEARCH_PATHS` (a
   Tauri quirk; the iOS Swift runtime needs it on the rpath).
5. The script patches the StoreKit scheme reference in the
   generated `.xcscheme` because XcodeGen does not write it.

`CFBundleShortVersionString` and `CFBundleVersion` auto-inject
from `tauri.conf.json.version`. Never hardcode the version in
`project.yml`; the version source is `tauri.conf.json`.

### The Swift plugins

Each Tauri plugin that needs native iOS behavior has an
`ios/Sources/` directory with Swift files that conform to the
Tauri plugin protocol. The plugin's `mobile.rs` (section 05)
registers the iOS half via `tauri::ios_plugin_binding!`:

```rust
#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_stt);
```

The Swift side implements the methods the Rust plugin declares
(`prepare`, `startSession`, `stopSession`, etc.). Wire-format
strictness applies on both sides; the `availableMemoryMB`
rename war story in section 05 is the iOS half of that contract.

### Capabilities the app needs

A small set of iOS capabilities are enabled on the app target
through `project.yml` settings and `corpan_iOS.entitlements`:

- **In-App Purchase** (for `tauri-plugin-iap` and
  `tauri-plugin-subscriptions`).
- **Background Audio** (for `tauri-plugin-audio-keepalive`, so
  narration playback survives lock-screen and app-background).
- **Microphone** (for `tauri-plugin-stt`'s pronunciation coach).
- **Speech Recognition** (when the iOS-native
  `SFSpeechRecognizer` fallback path is in use).

Each capability is also reflected in `Info.plist`'s usage
strings (`NSMicrophoneUsageDescription`, etc.). Apple's App
Review rejects builds whose usage strings do not honestly
describe the use.

### PrivacyInfo.xcprivacy

Apple requires `PrivacyInfo.xcprivacy` since iOS 17. Corpán's
declaration (per the runbook):

- `NSPrivacyTracking = false` (no third-party tracking SDKs).
- `NSPrivacyCollectedDataTypes = []` (Corpán core collects
  nothing user-identifying).
- `NSPrivacyAccessedAPITypes` lists the Required Reason APIs
  the app touches: `UserDefaults` (`CA92.1`), `DiskSpace`
  (`E174.1`), `FileTimestamp` (`C617.1`).

The file is committed at
`src-tauri/ios/corpan_iOS/PrivacyInfo.xcprivacy`.

### In-app purchase

`tauri-plugin-iap` and `tauri-plugin-subscriptions` are the two
plugins that make IAP work. The StoreKit test configuration at
`Corpan.storekit` defines:

- `corpan.sub.monthly` and `corpan.sub.annual` as subscriptions
  in the `corpan_premium_access` group.
- Sample non-subscription products (per-book purchases).

`corpan/infra/IAP_SETUP_RUNBOOK.md` is the canonical runbook for
registering products on App Store Connect; the shadow-launch
strategy (register the products, ship them inactive, switch on
later) is described there.

### Apple Feedback Assistant

The `open_apple_feedback` command in `lib.rs:1232` (section 04)
opens the Feedback Assistant app or falls back to the Apple
Support app or the web feedback form, in that order. This is
how the in-app "Send feedback" button gets the user into the
real Apple feedback path during the beta program; without it,
TestFlight users have no obvious path to file a structured bug
report.

The trick this command encodes: try several URL schemes in
order, fall through silently on each `Err`, return success on
the first one that opens. The result is a button that does
the right thing on every iOS device regardless of which feedback
apps are installed.

### App Store submission

The submission flow on a developer's machine:

1. `cd corpan/corpan-app && ./scripts/ios-gen.sh --clean` to
   regenerate the Xcode project from the template.
2. `npm run tauri ios build` to compile Rust, run Vite, link
   the static lib into the Xcode target, and produce a release
   archive.
3. `xcodebuild -exportArchive -exportOptionsPlist
   src-tauri/ios/ExportOptions.plist` to produce the `.ipa`.
4. Upload via Xcode's Organizer, Transporter, or
   `xcrun altool`. TestFlight processes the build; the team
   beta-tests; submission for App Store review follows.

`RELEASE_NOTES_*.md` at the repo root carry the per-version
"What's new" copy in 30+ locales (sample from `RELEASE_NOTES_0.13.1.md`
above). The release notes ship with the binary; one block per
locale, headline-first.

## Common operations

1. **Regenerate the Xcode project.**
   `cd corpan/corpan-app && ./scripts/ios-gen.sh --clean`.
2. **Build for the simulator.**
   `npm run tauri ios dev`. Vite serves the React tree; the
   Tauri-built binary runs in Simulator with hot reload.
3. **Build for a device or TestFlight.**
   `npm run tauri ios build`. Produces an archive in Xcode's
   archive directory; upload from there.
4. **Test IAP without live products.** Run on the simulator
   with the StoreKit Configuration `Corpan.storekit` active.
   StoreKit simulates the purchase flow against the
   configuration.
5. **Verify a build's bundle version.**
   `defaults read $(pwd)/gen/apple/build/<config>/corpan.app/Info.plist
   CFBundleShortVersionString`. Confirms the auto-inject from
   `tauri.conf.json.version` landed.
6. **Capture an iOS-only log from a running app.**
   `xcrun simctl spawn booted log stream --predicate 'process
   == "corpan"' --level debug` while the simulator is running.

## Why we built it this way

XcodeGen plus the regen script is the choice that makes the
iOS project plain text. Without it, the source of truth for
"what is the Xcode project" is a hand-edited `.xcodeproj`
binary that nobody reviews; with it, the source is a YAML file
that diffs cleanly and that can be edited by any tool. The
cost (a regen step in the build) is invisible because the
script runs in CI.

Tauri's iOS target instead of a custom Swift app is the choice
that lets the React tree ship to iOS at all. The alternative
(rewrite the UI in SwiftUI) would double the engineering
investment and split the codebase; the Tauri path means the
same `MainExperience.tsx` (section 06) runs on iOS, Android,
and desktop.

The strict-no-edit rule on `gen/apple/` is the discipline that
keeps the iOS project regeneratable. Once a hand-edit lands in
`gen/`, the next regen wipes it; without the rule, every
maintainer learns this the hard way. The template directory is
the place to put platform changes that need to persist.

The capability declarations and `PrivacyInfo.xcprivacy` are not
optional. Apple's App Review rejects builds whose declared
behavior does not match what the app does; keeping the
declarations honest (and short) is the smallest discipline that
keeps reviews short.

## To go deeper

- `corpan/APP_RELEASE_0_11_3.md` for the canonical iOS release
  punch list.
- `corpan/infra/IAP_SETUP_RUNBOOK.md` for App Store Connect
  product registration.
- Apple's "App Distribution" docs at
  `developer.apple.com/documentation/Xcode/distributing-your-app-for-beta-testing-and-releases`.
- XcodeGen at `github.com/yonaskolb/XcodeGen` for the
  `project.yml` reference.
- Section 04 for the Tauri runtime story; section 05 for the
  Swift plugin shape; section 28 for the Android counterpart.

---

# 28. Android

## What it is

Android is the second platform Corpán ships to, and the one where
the runtime's roughest edges live. The Tauri Android target wraps
the same Rust binary that powers iOS and desktop, but the Android
WebView and the Android lifecycle introduce specific failure
modes that the iOS path does not. The Android exit prevention
code (section 04's worked example) is one such mode; the
vendored `ndk-context` fork is another.

Kotlin is the native language on this side of the seam. Each
Tauri plugin that has Android behavior carries a Kotlin
implementation under its `android/` directory; the Rust
`mobile.rs` reaches it through
`api.register_android_plugin("com.corpora.<plugin>", "<KotlinClass>")`.
Section 05 walks the bridge through the STT plugin.

## How it fits

Android is at the same Tauri seam every platform is at (section
04). The differences from iOS are in the platform-native code
and the OS lifecycle. The same React tree, the same packs, the
same `MainExperience.tsx`. The platform-specific work is
contained to:

- Plugin Kotlin sources (`corpan/plugins/<name>/android/`).
- Android-specific manifest entries
  (`com.android.vending.BILLING`, microphone permission, etc.).
- The vendored `ndk-context` fork and the
  `prevent_exit` discipline in `lib.rs:1314` (section 04).
- The Gradle build setup (compileSdk, ndk version, Java/Kotlin
  17 toolchain).
- The release signing key (`upload-keystore.jks`).
- The Play Store metadata and screenshots.

## Files and entry points

- `corpan/corpan-app/src-tauri/gen/android/`: the generated
  Android Gradle project. **Do not edit by hand;**
  `patch-android.sh` regenerates the platform-version pins on
  every run, and other parts come from
  `npx tauri android init`.
- `corpan/corpan-app/scripts/patch-android.sh`: the idempotent
  post-init patch. Pins `compileSdk=36`, `targetSdk=36`,
  `ndkVersion=28.2.13676358`, Java/Kotlin 17 source/target
  language version, and the source-target-deprecation suppressor.
  Safe to re-run.
- `corpan/corpan-app/src-tauri/upload-keystore.jks`: the release
  signing key for Play Store uploads. **Not** in git (the
  `.gitignore` excludes it); copies live on the machines that
  ship release builds.
- `corpan/corpan-app/src-tauri/Cargo.toml:53` `[patch.crates-io]`
  `ndk-context = { path = "vendor/ndk-context" }`: the vendored
  fork (section 04) that removes the upstream `assert!` that
  killed the process on Activity re-init.
- `corpan/plugins/<name>/android/`: the Kotlin sources for each
  plugin's Android half. The STT plugin's Kotlin lives at
  `corpan/plugins/tauri-plugin-stt/android/src/main/java/
  com/corpora/stt/SttPlugin.kt` (the `register_android_plugin`
  call in `mobile.rs:18` names it).
- `RELEASE_NOTES_0.12.7_ANDROID.md`: the Android-specific
  release notes block (sometimes the iOS and Android cuts have
  different headline copy).
- `corpan/CLAUDE.md` "Android" section: notes the
  `com.android.vending.BILLING` permission requirement and the
  upload-keystore path.

## How it works

### The Tauri Android target

`npx tauri android init` (run once per checkout) generates the
Gradle project at `src-tauri/gen/android/`. Subsequent builds run
through Gradle:

- `npm run tauri android dev` runs the binary in the emulator
  or on a connected device with hot-reloaded React.
- `npm run tauri android build` produces a signed AAB (Android
  App Bundle) and APK in `gen/android/app/build/outputs/`.

The Rust side compiles to a shared object (`.so`) per ABI
(arm64-v8a, armeabi-v7a, x86_64) and gets bundled into the AAB
through Gradle's NDK integration. The WebView is the system
WebView; Tauri does not bundle a browser.

### `patch-android.sh`

The post-init patch is the file most likely to need to change
when Android tooling moves. As of the v0.11.3 punch list:

```
compileSdk = 36
targetSdk = 36
ndkVersion = 28.2.13676358
sourceCompatibility = JavaVersion.VERSION_17
targetCompatibility = JavaVersion.VERSION_17
kotlinOptions { jvmTarget = "17" }
```

Plus a suppressor for the source/target deprecation warning
Gradle emits on every build. The script is idempotent (re-running
it produces the same diff); it does **not** currently touch
`AndroidManifest.xml`, so manifest changes that Tauri's
`tauri.conf.json` does not surface require hand-edits in the
gen directory or template-layer fixes.

The version numbers in the patch float with the Android
ecosystem. The release punch list flags them for re-validation
on each release; bumping the targetSdk above the current Play
Store requirement is the usual trigger.

### The Kotlin plugin side

Each plugin's `android/` directory is a small Gradle library
project. The class registered by name (`SttPlugin` for the STT
plugin) extends Tauri's plugin base and exposes methods named
exactly as the Rust side calls them (`prepare`,
`startSession`, `stopSession`, etc.). Wire-format strictness
applies on this side too; the camelCase field names on the
JSON wire have to match what the Kotlin data classes declare
(section 05's `availableMemoryMB` rename story is the same on
both halves).

The STT plugin's Kotlin code drives whisper.cpp via JNI: the C
library is built as part of the plugin's Gradle build, the JNI
glue calls into it, the Kotlin layer exposes the typed API
Tauri sees. Audio is captured through `AudioRecord` (at 16 kHz
mono, the rate whisper.cpp expects) and streamed into the
model.

### The `BILLING` permission

`tauri-plugin-iap` contributes the
`com.android.vending.BILLING` permission to the merged
`AndroidManifest.xml`. The permission is what lets the app
talk to the Play Store's billing client; without it, IAP
queries fail at runtime.

The current punch list flags that
`patch-android.sh` does **not** today verify the merged
`AndroidManifest.xml` includes the BILLING permission. The
runbook step is to read the regenerated manifest after a clean
`tauri android init` and confirm; if the merge does not pick it
up automatically, the plugin's `android/src/main/AndroidManifest.xml`
needs the explicit declaration.

### Release signing

Play Store uploads must be signed with the release keystore at
`src-tauri/upload-keystore.jks`. The keystore is **not** in
git; the machines that ship release builds (Jeff's laptop, the
Spark for some pipeline-driven builds) keep their own copies.
Losing the keystore means losing the ability to ship updates;
the keystore is backed up out of band.

The signing config lives in `gen/android/app/build.gradle.kts`,
which `tauri android init` writes; the keystore password and
key alias live in `gradle.properties` (also gitignored). A
fresh machine setting up release builds copies the keystore
and `gradle.properties` into place before the first
`tauri android build`.

### Play Store metadata

`RELEASE_NOTES_<version>_ANDROID.md` carries the per-version
Play Store "What's new" copy in the same 30+ locale shape as
the iOS notes (section 27). Screenshots and feature graphics
live under `corpan-assets/marketing/` (section 24); Play
Console review checks for ratings prompts, content rating, and
data safety declarations. The data-safety form mirrors the
iOS `PrivacyInfo.xcprivacy` declarations.

## Common operations

1. **Initialize an Android project for a fresh checkout.**
   `cd corpan/corpan-app && npx tauri android init`. Then
   `./scripts/patch-android.sh`.
2. **Build for the emulator.**
   `npm run tauri android dev`. Hot reload on the React side.
3. **Build a release AAB.**
   `npm run tauri android build`. Output in
   `gen/android/app/build/outputs/bundle/release/`. Upload to
   Play Console.
4. **Inspect a logcat trace from the device.**
   `adb logcat | grep -i 'corpan\|RustStdoutStderr'`. The
   `prevent_exit` log lines, JNI errors, and any Kotlin
   exceptions land here.
5. **Test IAP without live products.** Configure a Play
   Console license test account and add `corpan.sub.monthly` /
   `corpan.sub.annual` as test SKUs. The Play billing client
   honors test SKU prices.
6. **Confirm the vendored ndk-context fork is in use.**
   `cargo tree -p ndk-context` from
   `corpan-app/src-tauri/` should resolve to the local
   `vendor/ndk-context` path, not crates.io.

## Why we built it this way

The vendored `ndk-context` fork plus the `prevent_exit`
discipline are the response to a real shipped crash on real
devices. Section 04 walks the chain of failures; the short
version is that upstream Tauri's lifecycle was killing the
process in a way that ran C++ destructors over live OS state,
and the workaround is to never exit. Documenting both the fix
and the rationale next to the code is the only practice that
prevents a future contributor from "cleaning up" the unused
event handler and re-shipping the crash.

The regen-script approach mirrors iOS (section 27). The
generated Gradle project is rebuilt from a small set of
template files and a patch script; `gen/android/` is not the
source of truth, the templates and the patch are.

Whisper on CPU via NEON instead of NNAPI is the configuration
the pronunciation coach ships with. NNAPI is available in
principle, but the gain for the model sizes the coach uses is
small and the configuration complexity is high; the v0.12.6
shipped configuration is "Pronunciation coach on Android CPU,
whisper.cpp" per `PIPELINE_STATE`.

The Play Console requirements (data safety, content rating,
ratings prompts) are honest declarations of what the app does;
keeping them honest is what keeps reviews fast. Section 27's
iOS counterparts mirror this.

## To go deeper

- `corpan/APP_RELEASE_0_11_3.md` for the cross-platform
  release punch list; Android-specific items live alongside
  the iOS ones.
- `RELEASE_NOTES_0.12.7_ANDROID.md` for an Android-specific
  release-notes example.
- Tauri's Android docs at `v2.tauri.app/develop/mobile/android/`.
- Android's WebView documentation at
  `developer.android.com/reference/android/webkit/WebView`.
- Section 04 for the prevent_exit story; section 05 for the
  Kotlin / Swift plugin shape; section 27 for the iOS
  counterpart.

---

# 29. Desktop

## What it is

Desktop is the third target Corpán ships to, covering macOS,
Windows, and Linux. The same Tauri binary that runs on iOS and
Android runs on the desktop too; the build path produces a
platform-native bundle (`.app` for macOS, `.exe` and `.msi` for
Windows, `.deb` and `.AppImage` for Linux) and the WebView is
the OS-provided one (`WKWebView` on macOS, `WebView2` on
Windows, `WebKitGTK` on Linux).

On desktop, the surface that needs adapting is small. The
WebView differences are absorbed by Tauri; the plugins that
matter on mobile (STT for pronunciation, IAP for paid content,
audio-keepalive for background playback) either stub out or
behave differently because the desktop user experience does not
ask for them today. Section 05's `desktop.rs` stub for the STT
plugin ("STT not supported on desktop in this build") is the
canonical example.

## How it fits

Desktop is the lightest-weight platform target in the codebase
not because the work is small but because the team has chosen
not to chase parity beyond the basics. The audiobook reader
works; the catalog works; the marketing site embed works. The
pronunciation coach does not, because nobody is asking for it
on desktop yet. When that changes, the desktop side grows
real behavior.

The reason for the asymmetry is the audience. Corpán's primary
users use phones for the listening and the drilling work. The
desktop target exists for development (`npm run tauri dev`),
for content authors who prefer a bigger screen, and for the
small set of users who want to listen on a laptop. The build
binary is real; the App Store / Microsoft Store / package
manager distribution is not the main channel.

## Files and entry points

- `corpan/corpan-app/src-tauri/tauri.conf.json`: the
  `app.windows[0]` block sets defaults for desktop window
  size (`1200 x 1000`) and devtools (`true`). The
  `bundle.macOS.signingIdentity` field carries the Mac App
  Store distribution certificate name
  (`"3rd Party Mac Developer Application: Corpora Inc (F9AV5HKF6N)"`).
- `corpan/corpan-app/src-tauri/icons/`: the icons used for
  bundle outputs across platforms. Tauri picks the right
  format per target.
- `corpan/plugins/<name>/src/desktop.rs`: each Tauri plugin's
  desktop module. Most are minimal: either they implement the
  command (TTS uses the OS-native speech synthesizer through
  the system's audio API) or they stub to "not supported"
  (STT, currently).
- `corpan/corpan-app/src-tauri/src/lib.rs:1232`
  (`open_apple_feedback`): the function exits with "Feedback
  Assistant is only available on Apple platforms" on Windows
  and Linux. Section 04 walks the worked example.

## How it works

### Tauri on desktop

`npm run tauri dev` from `corpan-app/` runs Vite (section 08)
and launches the Tauri binary. The binary opens a window
matching `tauri.conf.json`'s `app.windows[0]` config and
points its WebView at the Vite dev server. Edits to React land
in the running window through HMR; edits to Rust trigger a
binary rebuild and relaunch.

`npm run tauri build` produces platform-specific bundles. On
macOS the output is an `.app`, an `.dmg`, and (because of the
Mac App Store signing identity) the bits needed to submit to
the Mac App Store via Transporter or the Xcode Organizer. On
Windows the output is an `.exe`, an `.msi`, and an `.nsis`
installer. On Linux the output is a `.deb`, an `.AppImage`,
and (when configured) an `.rpm`.

### The WebView differences

The three desktop WebViews behave slightly differently:

- **macOS WKWebView**: closest to mobile Safari. Most Web
  features iOS supports work here too. Devtools opens through
  the Safari Web Inspector when the WebView's `allowsInspector`
  is enabled (Tauri exposes this; `devtools: true` in
  `tauri.conf.json`).
- **Windows WebView2**: Chromium-based. Devtools is the
  Chromium DevTools, opened via Right-click -> Inspect or
  `Ctrl+Shift+I`.
- **Linux WebKitGTK**: WebKit upstream, often a few versions
  behind Safari. Devtools is WebKitGTK's, opened via the same
  Right-click path.

The packs (section 11) target `es2020` (section 08), so
JavaScript syntax is uniform across all three. CSS uses the
Tailwind v4 vocabulary (section 09), which is broadly
compatible. The one place differences show up is Web Audio:
the iOS Opus-in-OGG story (section 18) is a WebKit gotcha that
affects macOS and Linux's WebKitGTK too; the WAV-for-in-zip
samples mitigation applies on desktop as well.

### The desktop plugins

Most Tauri plugins have a desktop module that either:

- Implements the plugin's behavior natively
  (`tauri-plugin-tts` calls into AVSpeechSynthesizer on macOS,
  SAPI on Windows, eSpeak NG on Linux).
- Stubs the behavior because the desktop user does not need it
  (`tauri-plugin-stt`'s `desktop.rs` returns `not supported`
  in this build).

The STT stub is intentional. Implementing whisper.cpp on
desktop is not technically hard (the model runs faster on a
laptop CPU than on a phone, in absolute terms), but the
pronunciation coach is not shipping on desktop and adding the
build complexity for an unshipped feature is the wrong call
today. The stub returns a clean `not available` from
`getStatus()`, and the pack's UI shows "Pronunciation coach is
not available on desktop." Section 05 walks the stub pattern.

### Window sizing and devtools

`tauri.conf.json` configures the desktop window:

```jsonc
"app": {
  "windows": [
    {
      "title": "Corpán",
      "devtools": true,
      "width": 1200,
      "height": 1000
    }
  ],
  "security": { "csp": null }
}
```

`width: 1200` and `height: 1000` is a deliberately generous
default; the reading experience benefits from a tall window.
`devtools: true` is on; for ship builds where devtools should
be off, a per-environment override is the path.

### Code signing

Mac App Store submission requires the
`"3rd Party Mac Developer Application: Corpora Inc (F9AV5HKF6N)"`
identity. Tauri's build picks it up from `tauri.conf.json` and
signs the `.app` bundle; uploading to App Store Connect goes
through Transporter or `xcrun altool`. Notarization (the
non-Mac-App-Store distribution path that opens the app outside
the store) requires a separate Developer ID Application
certificate; the codebase does not currently configure this.

Windows code signing requires an EV code signing certificate;
the codebase does not currently configure this for production
distribution. Linux distribution is unsigned (the convention).

## Common operations

1. **Run the app in desktop dev mode.** From
   `corpan/corpan-app/`: `npm run tauri dev`. Window opens
   matching the config defaults; React hot reload is wired.
2. **Build a desktop release.**
   `npm run tauri build`. Output appears in
   `src-tauri/target/release/bundle/`.
3. **Open the WebView devtools.** On macOS:
   Safari -> Develop -> [Mac name] -> [Corpán window]. On
   Windows: right-click anywhere -> Inspect. On Linux:
   right-click -> Inspect Element.
4. **Override the window size for development.** Edit
   `tauri.conf.json`'s `app.windows[0]` fields. Restart the
   dev binary.
5. **Verify a build's bundle structure.** On macOS:
   `ls -la target/release/bundle/macos/corpan.app/Contents/`.
   Tauri lays out the macOS bundle the same way Xcode would.
6. **Confirm a desktop plugin is stubbed correctly.** Call
   the plugin from a test pack or from the running app; check
   the return shape matches the `not supported` contract the
   stub declares.

## Why we built it this way

One Tauri binary across all three desktop OSes is the choice
that lets the same React tree, the same packs, and the same
SDK reach a third platform family without a parallel codebase.
The cost (a small set of platform-specific build configs and
the WebView differences) is contained; the benefit (a single
source of truth for "Corpán") is real.

Stubbing rather than implementing every plugin on desktop is
the choice that keeps the desktop build clean while leaving
room. The stub is honest: `getStatus()` returns
`available: false` and a human-readable message; the pack's UI
respects it. The day a desktop pronunciation coach makes sense
is the day to grow the stub into a real implementation.

The Mac App Store signing identity in `tauri.conf.json` is the
configuration the codebase commits to; the corresponding
keychain certificate lives on developer machines that ship Mac
App Store releases. Notarization for the non-Mac-App-Store
path and Windows code signing are deferred until the team
has a reason to ship outside the App Store; the cost of
configuring them is small but not free.

The generous default window size (1200 x 1000) is one of the
small choices that respects the reading experience on desktop.
A 800 x 600 default would crowd the paragraph view; the larger
window gives the reader room to breathe.

## To go deeper

- Tauri's "Building and Distributing" guide at
  `v2.tauri.app/develop/build/`.
- Apple's Mac App Store submission docs at
  `developer.apple.com/macos/submit/`.
- Microsoft's WebView2 docs at
  `learn.microsoft.com/en-us/microsoft-edge/webview2/`.
- WebKitGTK at `webkitgtk.org`.
- Section 04 for the Tauri runtime story; sections 27 and 28
  for the mobile counterparts.

---

# 30. Languages

## What it is

This project uses five general-purpose programming languages
across its trees: TypeScript, Rust, Python, Kotlin, and Swift.
Plus several supporting languages that are not general-purpose
but are load-bearing in specific places (HTML, CSS, SQL, YAML,
JSON, Markdown, LaTeX, Lua). The decision of which language to
reach for is fixed enough that the codebase reads like one
language was picked per concern.

This is the directory of those concerns. Each language has its
own deep dive in another section; this one is the menu.

## How it fits

The five general-purpose languages line up against the four
parts of the system:

| Concern                       | Language     | Section |
|-------------------------------|--------------|---------|
| App UI (React tree)           | TypeScript   | 06, 07  |
| Tauri host (privileged work)  | Rust         | 04, 05  |
| Tauri plugin Android halves   | Kotlin       | 05, 28  |
| Tauri plugin iOS halves       | Swift        | 05, 27  |
| Authoring + pipelines         | Python       | 19      |

There is no overlap. A new piece of work picks its language by
where it lands in this map. A new screen is TypeScript; a new
Tauri command is Rust; a new Android-side plugin method is
Kotlin; a new iOS-side plugin method is Swift; a new pipeline
stage is Python.

## Files and entry points

For each language, the canonical entry point to learn its role
in the codebase:

- **TypeScript**:
  `corpan/corpan-app/src/components/MainExperience.tsx` (648
  lines), the main loop. Section 06 walks it.
- **Rust**:
  `corpan/corpan-app/src-tauri/src/lib.rs` (1,338 lines), the
  Tauri builder and IPC handlers. Section 04 walks the seams;
  section 05 walks the STT plugin as a worked example.
- **Python**:
  `corpan/dja/cor/models.py` (161 lines), the Django CMS
  schema. Section 19 maps the rest of Python's footprint.
- **Kotlin**:
  `corpan/plugins/tauri-plugin-stt/android/src/main/java/com/
  corpora/stt/SttPlugin.kt` (the Android STT plugin). Section
  28 covers Android-specifics.
- **Swift**:
  `corpan/plugins/tauri-plugin-stt/ios/Sources/SttPlugin.swift`
  (the iOS STT plugin) and the test scratches in
  `corpan-app/test_*.swift`. Section 27 covers iOS-specifics.

## How it works

### TypeScript: typed JavaScript for the UI

What it is: JavaScript with a static type system layered on top
(section 07). Erases at compile time; runs as plain JS.

Why we use it: every UI surface in the project is either
TypeScript or trivially small enough to be JavaScript. The
React tree, the pack runtimes, the Tauri JS API wrappers, the
shared SDK types, the Vite configs. The type system is the
load-bearing piece; it keeps the IPC seam and the pack-host
contract honest.

Where it lives: anywhere with a `.ts` or `.tsx` extension. The
big concentrations are `corpan/corpan-app/src/` (the React
tree), `corpan/packs/<pack>/src/` (each pack's code), and
`corpan/packs/shared/*` (the cross-pack libraries).

To learn it: the TypeScript handbook at
`typescriptlang.org/docs/handbook/2/`. Section 07 walks the
SDK's `index.d.ts` as the worked example.

### Rust: ownership and zero-overhead abstractions

What it is: a systems programming language whose compiler
enforces ownership and lifetimes (section 05). Compiles to
native code; no runtime garbage collector; produces small
binaries.

Why we use it: Tauri is Rust on the host side, so the choice is
made by the framework. The plugins are Rust because they
extend Tauri. The Corpán app's privileged work (SQLite, HTTPS,
pack install) is Rust because the ownership model fits the
shape of the work, and because the resulting binary is small
enough to ship on mobile.

Where it lives: anywhere with a `.rs` extension. The big
concentrations are `corpan/corpan-app/src-tauri/src/` (the
Tauri host) and `corpan/plugins/<plugin>/src/` (each plugin's
shared crate).

To learn it: *The Rust Programming Language* book at
`doc.rust-lang.org/book/`. Section 05 walks the STT plugin
end to end.

### Python: pipelines and authoring

What it is: a dynamic, interpreted language with a vast
ecosystem of scientific computing, ML, and web frameworks.

Why we use it: every pipeline in this project (narration, audio
mastering, catalog generation, YouTube uploads, voice clone
experimentation) is Python. Django is the CMS for the corpus.
The ecosystem is where the wins are.

Where it lives: never on the user's device. Always offline.
`corpan/dja/` for Django, `corpan/infra/` for the catalog and
captures scripts, `voices/scripts/` for the voice clone
experiments, the smaller Django sub-projects in `arb/`,
`panko/`, and `total-history/`, and `~/projects/ttsctl/` on the
Spark for the narration pipeline (section 22).

To learn it: depends on what for. The Django tutorial at
`docs.djangoproject.com/en/5.1/intro/tutorial01/` for the CMS
side; *Fluent Python* (Ramalho) for the language. Section 19
maps the Python footprint.

### Kotlin: Android's modern language

What it is: a JVM language designed as a more pleasant Java.
First-class on Android since 2019; the language Android Studio
templates default to.

Why we use it: Tauri's Android plugin API expects Java or
Kotlin. Kotlin is the friendlier choice (null safety, data
classes, extension functions, coroutines), and the Android
Studio tooling assumes it.

Where it lives: `corpan/plugins/<plugin>/android/src/main/java/
com/corpora/<plugin>/<PluginClass>.kt`. The Kotlin half of each
Tauri plugin (where present); the generated Android project at
`corpan-app/src-tauri/gen/android/` does not contain
hand-written Kotlin.

To learn it: the Kotlin docs at `kotlinlang.org/docs/`. The
"Get started" guide is enough to read the plugin halves; the
Android-specific patterns are in Android Studio's templates.

### Swift: Apple's modern language

What it is: a typed, ARC-managed language Apple introduced in
2014 to replace Objective-C. Native to every Apple platform.

Why we use it: Tauri's iOS plugin API expects Swift (or
Objective-C; Swift is what Tauri's templates produce). Apple's
frameworks (AVFoundation, AVSpeechSynthesizer, StoreKit,
SFSpeechRecognizer, Vision, the IAP APIs) are exposed first to
Swift.

Where it lives: `corpan/plugins/<plugin>/ios/Sources/
<PluginClass>.swift`. The iOS half of each Tauri plugin; the
generated Xcode project at `corpan-app/src-tauri/gen/apple/`
does not contain hand-written Swift beyond the plugin glue.

To learn it: *The Swift Programming Language* book at
`docs.swift.org/swift-book/`. The "Language Guide" chapter is
enough to read the plugin halves.

### The supporting languages

These do not get their own deep-dive section but show up
frequently enough to warrant naming:

- **HTML**: one file per pack and one in the app
  (`corpan-app/index.html`), used as Vite's entry. Plus a small
  set of templates under `web/pages/templates/` for the static
  Pages site.
- **CSS**: tens of files, mostly via Tailwind v4 (section 09).
  Plain CSS where the pack's visual identity requires it.
- **SQL**: declarative in Django (Python models become SQL);
  hand-written in the Rust queries (section 16).
- **YAML**: build configs (`tauri.conf.json` is JSON; the
  Android `build.gradle.kts` is Kotlin DSL; XcodeGen's
  `project.yml` is YAML; GitHub Actions workflows are YAML;
  pack pipelines' `narration.yaml`).
- **JSON**: every pack manifest, every audio manifest, every
  segments file, every catalog patch. Section 17.
- **Markdown**: every book source, every Codex section, every
  README, every CHANGELOG, every runbook.
- **LaTeX**: book typesetting for `yijing`,
  `third-grade-homeschool`, and other typeset books.
- **Lua**: Pandoc filters under `yijing/hrule.lua`,
  `no_apostrophe_space.lua`. Pandoc invokes them during PDF
  builds.

### The mental model for picking the right language

The decision tree is short:

```
Does this run on a user's device?
  yes → which side of the Tauri seam?
    React tree → TypeScript
    Tauri host or plugin shared → Rust
    Android-specific plugin half → Kotlin
    iOS-specific plugin half → Swift
  no → does it produce assets?
    yes → Python (Django for CMS, scripts for pipelines)
    no → is it shell-shaped?
      yes → bash (section 31)
      no → Python
```

The model is not "pick the best language for this task";
it is "pick the language this kind of task lives in." The
sameness of language-per-concern is what makes the codebase
navigable: any Rust file is a Tauri host or plugin, any
Python file is a pipeline or a Django app, any Swift file is
an iOS plugin half. There are no surprises.

## Common operations

1. **Pick a language for a new piece of work.** Trace the
   decision tree above. If the answer is unclear, ask whether
   the work belongs in an existing file; the language of that
   file is usually the right one.
2. **Find every file of a language.**
   `find . -name '*.ts' -o -name '*.tsx'` (or `.rs`, `.py`,
   `.kt`, `.swift`) from the repo root.
3. **Read the canonical entry point.** See the list at the top
   of this section.
4. **Add a new section in a different language.** Follow the
   matching deep-dive section's "Common operations" 3 (Adding
   a command, Adding a model, etc.).
5. **Audit cross-language seams.** The IPC boundary (section
   04) is one. The pack-host contract (section 12) is another.
   The Django-to-Rust SQLite handoff (section 16) is a third.
6. **Read a file you have never seen.** Open the smallest
   file in its directory. Languages this strict usually have
   conventions that make any one file representative of the
   rest.

## Why we built it this way

Five languages instead of one is the cost of the platform
choices the rest of the manual already justified. Tauri pulls
in Rust; React pulls in TypeScript; the pipelines need
Python's ecosystem; Android and iOS each have a native
language. The team did not choose five languages; the team
chose Tauri plus React plus a Python-based pipeline plus
shipping to iOS and Android, and the five languages followed.

What the team did choose was the discipline of one language per
concern. There is no "well, this Rust file calls into Python
via PyO3" anywhere in the codebase; the Python and the Rust
talk through file shapes on disk. There is no JavaScript on
the Rust side and no Rust in the React tree. The seam between
each pair of languages is small, named, and one-way; the cost
of context-switching is paid where the work pays it back.

The supporting languages (HTML, CSS, SQL, YAML, JSON,
Markdown, LaTeX, Lua) are each load-bearing only inside the
narrow context that uses them. They earn no deep-dive section
because they have no surprises in this codebase; they do the
thing they do everywhere.

## To go deeper

- Each language's deep-dive section: TypeScript (07), Rust
  (05), Python (19), Kotlin (28's Plugin section), Swift
  (27's Plugin section).
- *The Practice of Programming* (Kernighan and Pike) for the
  case for taking a small set of languages and getting fluent
  in their idioms rather than picking the trendy one each time.
- *Programming Language Pragmatics* (Scott) for the deeper
  case for why language design matters and why differences
  between languages are not arbitrary.

---

# 31. The Shell

## What it is

The shell is the glue. Most of the project's automation that is
not a Python pipeline or a Tauri command is a bash script.
Hydrating audio from S3, syncing voice references, kicking off
the iOS regen, patching the Android build, running the captures
pipeline, bootstrapping a fresh checkout: all of those are
short shell scripts under `corpan/infra/`,
`corpan/corpan-app/scripts/`, `web/scripts/`, and
`voices/scripts/`. The shell does not produce content; it moves
things around.

The convention across the codebase is bash with `set -euo
pipefail`, executable bit on, shebang `#!/bin/bash` (or
`#!/usr/bin/env bash` for the cross-platform variant), and a
docstring-style comment block at the top explaining the script's
purpose, prerequisites, and usage. The team's daily shell is
zsh; the scripts target bash for portability.

## How it fits

The shell sits at the join between manual work and automated
work. A developer or a marketer kicks off a shell script; the
script does the thing; the developer or marketer reads the
output. The shell is the "I want to do this once, but I want it
to be the same way every time" layer.

Where the shell does **not** sit: anywhere that needs
non-trivial logic. Once a script grows past three pipes or
starts juggling JSON, it migrates to Python (section 19). The
infra/captures pipeline is the canonical example:
`build-capture.sh` is shell because it orchestrates ffmpeg
calls; `trim-deadair.py` is Python because it inspects audio
waveforms; `build-and-upload.sh` is shell again because it
ties the previous two to a Python CLI (`corpan-yt`). Each
script does the thing its language is good at.

## Files and entry points

The big concentrations of shell are:

- **`corpan/infra/`**: the hydration and sync scripts.
  `hydrate-audio.sh`, `hydrate-voices.sh`,
  `hydrate-marketing.sh`, `sync-voices-to-s3.sh`,
  `sync-marketing-to-s3.sh`.
- **`corpan/infra/captures/`**: the captures pipeline.
  `build-capture.sh`, `build-and-upload.sh`,
  `sync-captures-to-s3.sh`, `hydrate-captures.sh`.
- **`corpan/corpan-app/scripts/`**: the build helpers.
  `ios-gen.sh`, `patch-android.sh`,
  `capture-stt-log.sh`, `rebuild-hanzi-pack.sh`.
- **`web/scripts/`**: the public-site build glue.
  `setup.sh` (the bootstrap), `serve-local.sh` (the one-shot
  build-and-serve).
- **`voices/scripts/`**: the voice-clone audition shell that
  wraps the Python audition scripts.
- **`corpan/dja/add_translations.sh`**: a thin bash wrapper
  around a Django management command.

Most non-shell tooling in the codebase has its own scripts
directory; even when the script body is one line, the
discipline is to write the script down so the command is
reproducible.

## How it works

### The shape every script follows

A typical script in this repo looks like:

```bash
#!/bin/bash
# Short description of what this script does.
#
# Prerequisites:
#   - AWS CLI installed
#   - ~/.aws/credentials has [corpan-publisher] profile
#
# Usage:
#   ./corpan/infra/sync-voices-to-s3.sh

set -euo pipefail

VOICES_DIR="${HOME}/encorpora/voices/data"
S3_DEST="s3://corpan-prod/sources/voices/data/"

# ... the work ...
```

Four things to read off the shape:

1. **The shebang names bash explicitly.** Even though the
   team's interactive shell is zsh, the scripts target bash
   for portability across macOS (which ships an older bash
   but supports `#!/usr/bin/env bash` for Homebrew bash) and
   Linux runners.
2. **The comment block is the docs.** Every script that
   anyone calls has a comment block at the top with what it
   does, what it needs, and how to call it. The discipline
   pays for itself the first time someone unfamiliar opens
   the script.
3. **`set -euo pipefail` is required.** `-e` exits on error,
   `-u` errors on unset variables, `-o pipefail` propagates
   errors through pipes. Without these, a failure in the
   middle of a sync silently leaves the bucket in a
   half-updated state. With them, the script either succeeds
   completely or fails loudly.
4. **Configuration is at the top.** Paths, S3 destinations,
   AWS profile names. `${HOME}`-prefixed paths and
   environment-variable overrides (`${MARKETING_DIR:-...}`) are
   the convention so a script can be reused across machines.

### When shell is the right tool

The shell is the right tool when:

- The work is "call this tool, then that tool, then check the
  output." File-system pipelines, S3 sync, ffmpeg orchestration.
- The dependencies are command-line tools that already exist
  on the developer's machine (`aws`, `curl`, `ffmpeg`,
  `jq`, `unzip`, `zip`).
- The script does not need to inspect its inputs beyond simple
  string operations.

When the shell is the wrong tool: anywhere the inputs need
parsing beyond `cut` and `sed`. The captures pipeline's audio
inspection (`trim-deadair.py`) is in Python because it walks
the audio waveform; the catalog patcher (`patch-catalog.py`)
is in Python because it edits structured JSON. The boundary
where shell stops and Python begins is "do I need to walk a
data structure?"

### `jq` and `aws` and `ffmpeg` as collaborators

Most shell scripts in this codebase are short because they
delegate to a handful of high-quality command-line tools:

- **`jq`** for JSON queries and patches. The hydrate scripts
  use it to pull narration metadata out of `catalog.json`.
- **`aws`** for S3 operations and CloudFront invalidations.
  The sync scripts use it; `ttsctl publish` on the Spark uses
  it.
- **`ffmpeg`** for audio and video processing. The captures
  pipeline uses it for the four-variant build (section 25).
- **`curl`** for HTTPS GETs. The hydrators use it against
  CloudFront.
- **`unzip`** / **`zip`** for pack archives. The hydrator
  extracts narration zips; the pack scripts (section 11)
  build pack zips.

The combination of bash with these tools is far more
productive than writing the same orchestration in Python
without them. A 60-line bash script that calls `aws`, `jq`,
`curl`, and `unzip` in sequence would be 200 lines of Python
to replicate.

### Bootstrapping vs working scripts

Two flavors of script appear:

- **Bootstrap scripts** (`web/scripts/setup.sh`, the
  per-pack `dev:corpan` scripts in `package.json`) set up a
  fresh checkout so the rest of the tooling works. Run once
  per machine; harmlessly idempotent on re-run.
- **Working scripts** (the sync, hydrate, build scripts) do
  the day-to-day jobs. Run as often as needed.

The bootstrap scripts tend to be the chattiest; they print
their progress because the user is watching. The working
scripts tend to be quieter, because they are often called from
other scripts or CI.

### One pattern worth naming: the `.env`-or-environment dance

Several scripts (`sync-marketing-to-s3.sh`,
`captures/build-and-upload.sh`) start with the same
"credentials from `.env` or from the environment" dance:

```bash
ENV_FILE="${ENV_FILE:-${HOME}/Code/corpora/encorpora/.env}"
if [ -f "$ENV_FILE" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  set -a; . "$ENV_FILE"; set +a
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${AWS_ACCESS_KEY:-}}"
fi
```

The pattern: the script prefers an already-set environment
variable, but falls back to sourcing a known `.env` file. The
`.env` file is gitignored; the credentials inside it are
per-developer. CI runs the same scripts with environment
variables set in the workflow config; the `.env` fallback
makes the dev loop pleasant.

## Common operations

1. **Write a new script.** Copy the shape (shebang, comment
   block, `set -euo pipefail`, top-level config). Drop it
   under the appropriate `scripts/` directory.
2. **Read what a script does.** Read the top-of-file comment
   block. If the comment block is missing, fix it.
3. **Run a script with overrides.** Most scripts honor
   environment variables for paths (`MARKETING_DIR=...`,
   `ENV_FILE=...`, `LOCAL_CAPTURES_DIR=...`). Set them in the
   shell or in the call.
4. **Lint a script.** `shellcheck script.sh`. The team does
   not require shellcheck-clean in CI, but the lint catches
   real bugs quickly.
5. **Debug a script.** Add `-x` to the shebang
   (`#!/bin/bash -x`) or run with `bash -x script.sh`. Every
   line is echoed before it runs.
6. **Make a script work on a fresh machine.** Copy the script.
   Install the dependencies the comment block names. Set
   credentials. Run.

## Why we built it this way

Shell scripts age well. A bash script written in 2020 still
runs in 2026 without modification; a Python script from the
same period might need a `requirements.txt` refresh, a
language-version bump, and an environment setup. The shell is
the closest thing to a write-once-run-forever automation
layer.

The cost of shell aging well is that the language itself is
crusty. Bash's quoting is hostile, its error handling without
`set -euo pipefail` is silent-failure-by-default, and its
data structures (associative arrays, in particular) are
awkward. The mitigation is to keep each script short, name
its dependencies, and lean on `jq`, `aws`, and `ffmpeg` for the
parts that would be ugly in pure bash.

The "shell as glue, Python as logic" split is the rule that
keeps both honest. A shell script that grows past 100 lines
or starts parsing its own structured input is a Python
script wearing a hat. A Python script that calls `aws` and
`ffmpeg` and `jq` and `curl` in sequence is a shell script
wearing a hat. Knowing which is which is the discipline.

The discipline of a comment block at the top of every script
is the smallest investment that makes the scripts hospitable.
A team member or an agent that has never seen a script can
read the comment, understand the inputs, and run it. Without
the comment, the same person reads the code, infers the
intent, runs the script, and discovers that one of the
inferred prerequisites was wrong. The comment costs three
lines.

## To go deeper

- *The Linux Command Line* (Shotts), free online at
  `linuxcommand.org/tlcl.php`. The chapters on bash scripting
  cover the patterns this codebase uses.
- *Pro Bash Programming* (Albing, Vossen) for the case where
  the script needs to do something the shell makes hard.
- `shellcheck.net` is the easiest way to catch the common
  pitfalls; the inline annotations on its web demo are
  worth the read even when you do not have a script to lint.
- Section 19 for the Python side of the same orchestration
  story; section 32 for the package managers each script
  depends on.

---

# 32. Package Management

## What it is

Each language in section 30 brings its own package manager. The
project uses four:

- **npm** for JavaScript and TypeScript packages
  (`package.json`, `package-lock.json`).
- **Cargo** for Rust crates (`Cargo.toml`, `Cargo.lock`).
- **pip** (and increasingly `uv`) for Python packages
  (`requirements.txt`, `pyproject.toml`).
- **Homebrew** for system-level binaries the build needs
  (`brew install` for `ffmpeg`, `jq`, `git-lfs`, `xcodegen`,
  Blender, etc.).

Each manages its own lockfile; each has its own conventions; each
gets to be the source of truth for its language's dependency tree.

## How it fits

Package management is the layer below every other layer. Without
it, a fresh checkout cannot build. The codebase ships per-
subsystem dependency declarations (a `package.json` in each
Vite project, a `Cargo.toml` in each Rust crate, a
`requirements.txt` or `pyproject.toml` for each Python tree)
and trusts each manager to resolve its own world.

The deliberate choice the project does not make: a monorepo-wide
dependency lock. There is no single `package.json` that pins
everything; there is no top-level Pipenv; the `Cargo.toml` files
are not unified into a workspace. The cost (per-subsystem
duplication) is small; the benefit (subsystems can move
independently) is real.

## Files and entry points

### npm

- Root `package.json`: declares the compose-the-site dev
  orchestrator (`concurrently`, `chokidar`, `wait-on`).
  Section 02 walks the `scripts` block.
- `corpan/corpan-app/package.json`: the app's React + Tauri
  deps. Big block.
- `corpan/corpan-app/package-lock.json`: the lockfile. In git.
- `web/io/package.json`: the Next.js site.
- `web/io/package-lock.json`: in git.
- Per-pack `package.json`: each pack's own deps (Vite, the
  engine of choice, zustand if needed).
- Per-pack `package-lock.json`: in git.

### Cargo

- `corpan/corpan-app/src-tauri/Cargo.toml`: the app's Rust deps,
  including path-deps into every plugin.
- `corpan/corpan-app/src-tauri/Cargo.lock`: **not** in git
  (section 03 explains; a `rusqlite` vs `sqlx` member mismatch
  prevents commit without churn).
- `corpan/plugins/<plugin>/Cargo.toml`: each plugin's manifest.
- Each plugin's `Cargo.lock`: not tracked.

### pip / uv

- `corpan/dja/requirements.txt`: Django CMS deps.
- `corpan/infra/captures/youtube/pyproject.toml` and
  `requirements.txt`: the `corpan-yt` CLI's deps.
- `panko/requirements.txt`: the Panko sub-project's deps.
- Other Python subtrees declare their own deps locally.

### Homebrew (and the macOS dev assumption)

There is no `Brewfile` in the repo today. The expected install
list (per the scripts' comment blocks) is roughly:

```
brew install git-lfs jq ffmpeg awscli xcodegen blender
brew install node@20
```

A `Brewfile` at the repo root is an obvious near-future
addition; without it, the per-script comment blocks are the
authoritative list.

## How it works

### Lockfiles, briefly

A lockfile records the exact version of every package the
project resolved to, including transitive dependencies. The
purpose: deterministic installs. Two developers running
`npm install` against the same `package.json` may, in the
absence of a lockfile, end up with subtly different transitive
versions (because the spec `^1.2.3` means "any 1.x.y where
y >= 3," and `npm` picks whatever is newest at that moment).
The lockfile pins the exact resolution; subsequent installs
reproduce it.

npm's `package-lock.json`, Cargo's `Cargo.lock`, and
pip's lock files (`requirements.txt` with pinned versions,
or `uv.lock`, or `poetry.lock`) all do the same job for their
respective languages.

### Why some lockfiles are in git and one is not

The norm is to commit lockfiles. Every `package-lock.json` in
this repo is committed. The exception is the Rust workspace's
`Cargo.lock`, which `.gitignore`s with a comment explaining the
reason: a `rusqlite` versus `sqlx` member-version mismatch
across the plugin crates would force frequent churn on the
lockfile even when the underlying dependencies have not
changed. The trade is deterministic Rust builds against the
churn cost; the team has accepted the churn cost for now and
will revisit when the upstream alignment converges.

For the apprentice: when in doubt, **commit the lockfile**.
The Rust exception is documented in the gitignore comment for
a reason; the same exception is not the default.

### Per-subsystem deps over monorepo deps

A monorepo dependency manager (Nx, Lerna, pnpm workspaces, a
Cargo workspace, Pipenv at the root) would let every subsystem
share a hoist of dependencies. The project does not do this.
The motivation, per section 19 for Python and the same logic
elsewhere: a pack's Vite version and the app's Vite version
do not need to match; the captures pipeline's Python and the
Django CMS's Python do not need to match. Forcing them to
match would couple unrelated cadences.

The cost is that the same package (Vite, esbuild, zustand)
appears in several `package-lock.json` files at slightly
different versions. The cost is small and reversible; the
alternative (a single Vite version every subsystem fights
about) is the wrong shape for a monorepo full of
intentionally-independent subsystems.

### `npm ci` vs `npm install`

CI uses `npm ci` (which installs strictly from the lockfile and
fails if `package.json` and the lockfile disagree). Developers
use `npm install` (which updates the lockfile to match changes
in `package.json`). The discipline: a PR that changes
dependencies updates the lockfile in the same commit; CI's
`npm ci` either succeeds or the PR is wrong.

The same shape applies to `cargo` (`cargo build` updates the
lockfile; the Rust exception means we do not commit the
update; CI does `cargo build` from scratch) and to `pip` /
`uv` (which the project's CI does not currently run; per-tree
`pip install -r requirements.txt` is the recipe).

### `legacy-peer-deps`

A small set of packs (Hover Runner, Juice Squeeze) install
with `npm install --legacy-peer-deps` per their CI workflow.
The flag bypasses npm's strict peer-dependency resolution,
which was tightened in npm 7+ and which surfaces conflicts that
older packs were authored against. The flag is documented in
`GITHUB_PAGES_SETUP.md`'s workflow snippet and in the GitHub
Actions config.

When the flag is needed, it is needed. The alternative
(updating every transitive peer-dependency to satisfy npm's
strict resolver) is sometimes more churn than the install
flag is worth.

### Homebrew as the system-binary layer

Homebrew sits below npm and Cargo. The binaries it provides
(`ffmpeg`, `jq`, `aws`, `git-lfs`, Blender, `xcodegen`) are
what the shell scripts call. The expectation is that a
developer is on macOS with Homebrew installed; the per-script
comment blocks declare which Homebrew packages are needed.
Linux developers install the same tools through their
distro's package manager; the script behavior is the same.

### `uv` for Python, where used

Some Python subtrees (the captures CLI, the dja project) are
moving toward `uv` for environment management. `uv` is a
Rust-implemented replacement for `pip` plus `venv` plus
`virtualenv`, and it is several times faster while honoring the
same `pyproject.toml` and `requirements.txt` formats. Where
the team uses `uv`, the recipe is:

```bash
uv venv
uv pip install -r requirements.txt
```

For an apprentice, `python -m venv` plus `pip install -r
requirements.txt` works identically; `uv` is the speed
upgrade, not a different concept.

## Common operations

1. **Install everything for the public site.**
   `npm install` from the repo root (orchestrator deps), then
   `cd web/io && npm install`, then per pack
   `cd corpan/packs/<pack> && npm install --legacy-peer-deps`
   (when needed).
2. **Install everything for the Tauri app.**
   `cd corpan/corpan-app && npm install`. Cargo deps install
   automatically on the first `cargo build` or
   `npm run tauri dev`.
3. **Install Django dependencies.**
   `cd corpan/dja && pip install -r requirements.txt` (in a
   venv) or `uv pip install -r requirements.txt` (with `uv`).
4. **Update a pinned dependency in one subsystem.** Edit the
   `package.json` (or `Cargo.toml`, etc.). Run the install
   command for that subsystem. Commit the updated lockfile.
5. **Reproduce a CI install locally.** `npm ci` instead of
   `npm install`. Fails fast on lockfile drift.
6. **Verify a Homebrew tool is present.**
   `command -v ffmpeg` (or whatever). If missing, install:
   `brew install ffmpeg`.

## Why we built it this way

Per-subsystem dependency manifests are the choice that lets
each subsystem move on its own schedule. A monorepo where
every subsystem must share a Vite version, an esbuild version,
a TypeScript version, is a monorepo where any one subsystem's
upgrade gates every other's. The duplication cost is small
because the packages themselves are small; the velocity cost
of unifying them would be daily.

Committing lockfiles is the choice that makes installs
reproducible. A fresh clone plus `npm ci` plus
`cargo build` produces a binary identical to the one CI
produces. The cost (the lockfile churn shows up in diffs)
is worth the deterministic result.

The Rust `Cargo.lock` exception is documented; the documentation
matters more than the choice. The comment in `.gitignore`
explains why; the future audit (when the underlying member
versions converge) can act on it. Without the documentation,
the next person finds a `Cargo.lock` they cannot commit and
spends an hour discovering why.

Homebrew (and the dev-machine assumption it carries) is the
choice that lets the scripts call `ffmpeg`, `jq`, `aws`, etc.
without re-distributing them. The cost is the macOS-first dev
loop; the benefit is that no script ships its own copy of
ffmpeg.

The path toward `uv` for Python is the natural consequence of
how much faster `uv` makes the install step. The project has
no rule that says "stop using pip"; it has a permissive rule
that says "either is fine, `uv` is faster when you have it."

## To go deeper

- npm docs at `docs.npmjs.com`; the "About semantic versioning"
  page is the one most worth understanding.
- The Cargo book at `doc.rust-lang.org/cargo/`.
- `pip` docs at `pip.pypa.io/en/stable/`; `uv` docs at
  `docs.astral.sh/uv/` if you reach for the speed upgrade.
- Homebrew docs at `docs.brew.sh`.
- Section 03 for the gitignore comment on `Cargo.lock`;
  section 19 for the per-subsystem-deps Python rationale.

---

# 33. Working with Agents

## What it is

The team works with AI coding agents (Claude Code, Cursor,
similar) as a daily practice. Several pieces of the codebase
visibly carry the fingerprints of this collaboration: the
`CLAUDE.md` and `AGENTS.md` files at various subtree roots
documenting agent-facing conventions, the pr-agent GitHub
Action (section 03) that posts LLM-generated summaries on every
PR, the `~/projects/ttsctl/changelog/decisions/` per-discovery
files that track agent-and-human investigation outcomes, and
the auto-memory system at
`~/.claude/projects/-Users-jeffryeverett-Code-encorpora/memory/`
that persists context across sessions.

This section is the practitioner's view of how the agents are
used productively in this codebase. Section 34 covers the
complement: what humans still hold in their heads.

## How it fits

The agent era is the current moment in software engineering;
this project is one of the codebases living through it. The
practical implications fall into a small set of patterns:

- **Worktrees as the parallelism primitive.** Three concurrent
  worktrees today (section 03), each on its own branch with its
  own agent. The mechanic exists because git supports it;
  using it routinely is the agent-era choice.
- **CLAUDE.md / AGENTS.md as agent-facing docs.** A handful of
  subtree roots have a markdown file specifically addressed to
  the agent that will land in that directory next. The corpus
  app's `corpan/CLAUDE.md` and the third-grade-homeschool's
  `AGENTS.md` are examples.
- **Auto-memory as state across conversations.** The
  per-project memory file under `~/.claude/projects/.../`
  records facts and feedback the agent should carry into the
  next conversation. The user maintains it; the agent reads it
  on session start.
- **Decision logs.** The Spark's
  `~/projects/ttsctl/changelog/decisions/` directory and the
  encorpora repo's `PIPELINE_STATE.md` together capture the
  per-discovery investigation outcomes the agent and the
  human made together.

## Files and entry points

- `corpan/CLAUDE.md`: the deepest agent-facing doc in the repo.
  Documents the corpan app's architecture for an agent
  landing there fresh.
- `corpan/CHANGELOGS.md`: the shippable-units doctrine.
  Agents that touch shippable units are expected to update
  changelogs in the same PR.
- `corpan/corpan-app/AGENTS.md`: agent-facing notes specific to
  the app subtree.
- `corpan/dja/AGENTS.md` (if present): Django-specific.
- `third-grade-homeschool/AGENTS.md` and similar: per-book
  agent-facing notes (style, formatting, math conventions).
- `web/io/AGENTS.md`: marketing-site-specific.
- `.github/workflows/pr-agent.yml`: the Codium PR-Agent action
  (section 03).
- `~/.claude/projects/-Users-jeffryeverett-Code-encorpora/memory/`
  (outside the repo): the auto-memory. `MEMORY.md` indexes the
  individual files.
- `PIPELINE_STATE.md` at the repo root: the dated snapshot
  Skylar maintains for the narration pipeline.

## How it works

### Briefing the agent

The single highest-leverage practice in this codebase is to
brief the agent like a smart colleague who just walked into the
room. The pattern, from the project's own conventions:

- Name the goal in one sentence.
- Name the constraints in one or two more.
- Name what has been tried.
- Name what is out of scope.
- Point at the specific files or sections the agent should
  read first.

The pattern is so consistent that the CLAUDE.md files codify it:
each subtree's CLAUDE.md is essentially a pre-written brief for
"the agent that lands in this directory next." Reading the
CLAUDE.md before reading any code is the agent's first move; if
the CLAUDE.md is absent or out of date, the human notices and
fixes it on the next pass.

### Plan vs action

Two modes the agent runs in:

- **Plan mode**: the agent reads, thinks, and proposes. No
  files change; the agent returns a structured plan the human
  can edit or approve.
- **Action mode**: the agent reads, thinks, and writes. Files
  change; the human reviews the resulting diff.

The discipline: ask for plan mode when the task is ambiguous
or far-reaching (a refactor, a new feature, a multi-step
investigation). Ask for action mode when the task is concrete
and the agent has the context it needs (a typo fix, a small
documented change, a recipe-style task).

The Codex itself is a plan-mode artifact in part: the briefing
the user gave the agent was a multi-page plan, and the agent's
first move was to produce the skeleton commit before writing
any prose. The skeleton was the plan made concrete.

### Worktrees as the parallel primitive

Three concurrent worktrees on the same disk means three agents
(or three Jeff / Skylar conversations) can each touch different
files at the same time. Section 03 walks the mechanic; the
practice is:

- One worktree per active piece of work. Not per branch in
  general, but per branch the human (or agent) is actively
  editing.
- The naming convention is `<project>-<branch-suffix>` (the
  current three are `encorpora`, `encorpora-ear`,
  `corpora-codex`).
- An agent in one worktree should **stay in its lane**. The
  shared object database does not prevent an agent in
  `corpora-codex` from editing files in `corpan/`; the
  discipline does.

The "stay in your lane" rule is the user's reminder during the
Codex session; it is the working norm.

### The auto-memory contract

The Claude Code agent reads
`~/.claude/projects/.../memory/MEMORY.md` on every session and
treats the indexed files as remembered context. The user
maintains the memory deliberately:

- Adds entries when a non-obvious fact is established (the
  Opus-in-OGG iOS gotcha, the no-dashes-in-tts-text rule, the
  voice-clone-locations note).
- Updates entries when state changes (Melopán's shipped
  version, Quest-Ear's current branch).
- Removes entries when something is no longer true.

The agent's job, on the consumer side: treat memory as
context for what was true at a point in time, verify before
acting on memory-derived recommendations, and surface
discrepancies the next time they appear.

The memory is not infrastructure the codebase ships; it is
infrastructure the user maintains for themselves. The Codex
sits beside it in the same spirit: documentation the user
maintains for future selves and future agents.

### The pr-agent loop

Every PR opened against `corpora-inc/encorpora` triggers the
`pr-agent.yml` workflow (section 03), which runs Codium's
PR-Agent against the diff. PR-Agent posts:

- A summary comment describing the change.
- A code review with line-level suggestions.
- Test-coverage observations (where applicable).

The agent's output is not a gate; humans (Skylar, primarily,
for this team) still review. The agent's contribution is the
first pass: a summary that surfaces what the PR actually
changes, suggestions that catch the obvious patterns. The
human's contribution is the judgment of whether the change is
right for the project right now.

### Discipline of reading the diff

The single largest reason to know how Git works (section 03) in
the agent era is to be able to read what the agent did. Every
agent action becomes a diff; the diff is the artifact the human
trusts or distrusts. The practices that pay off:

- `git status` before approving an agent's claim that it is
  done. The agent's understanding of "done" sometimes differs
  from the working tree.
- `git diff --stat` to see the shape of the change at a glance.
- `git diff <path>` to read the actual edits.
- `git log --oneline` after a session to confirm the commits
  look right.

The Codex's own session shows the pattern: every section
ended with the agent verifying hygiene
(`grep -c '—'`, `grep -c '§'`, `wc -l`) and then committing
with a descriptive message. The pattern is small and
mechanical; it is also the difference between trusting the
agent's claim and verifying it.

## Common operations

1. **Land in a new subtree as an agent.** Read the
   `CLAUDE.md` or `AGENTS.md` if present. Read `README.md` if
   not. Skim the file structure. Ask what the briefing did not
   answer.
2. **Brief an agent for a task.** Goal in one sentence,
   constraints in two more, what is tried, what is out of
   scope, which files to read first.
3. **Open a worktree for parallel work.** From an existing
   checkout: `git worktree add ../encorpora-<branch> <branch>`.
   Open the new directory in the editor of choice; agents
   work there independently.
4. **Update auto-memory after a discovery.** Open the relevant
   file under `~/.claude/projects/.../memory/`. Add an entry
   with the fact, the why, and how to apply it. Update
   `MEMORY.md` index if a new file was created.
5. **Use plan mode for a big change.** Ask for "a plan, no
   edits yet." Review the plan. Edit the plan. Then ask for
   "implement the agreed plan."
6. **Read the diff before merging an agent's PR.**
   `gh pr diff <number> | less` shows the patch as text;
   `gh pr review --approve` only after the diff makes sense.

## Why we built it this way

The agent era has not replaced the discipline of reading the
code; it has shifted the discipline. Where a single human
engineer used to read every line they wrote, a human plus an
agent now reads every line the agent wrote. The reading is
still the load-bearing activity; the writing has gotten
faster.

CLAUDE.md and AGENTS.md files in subtrees are the smallest
investment that brings the next agent up to speed. The cost is
a few minutes of writing per subtree; the benefit is that every
session after starts from a higher baseline. The Codex itself
is this practice taken to its logical end: a doc that
explains the system to its future readers, human and agent.

Worktrees as the routine parallel primitive are the
acknowledgment that an agent can be working on Quest-Ear while
Jeff is working on Melopán while Skylar is reviewing a
narration pipeline change. The previous era's pattern (one
checkout, careful stash-and-pop, hope nothing is lost) breaks
down the moment three contexts are active at once.

The auto-memory pattern is the smallest mechanism for
preserving the "I learned this last week" context across
sessions. Without it, every session re-discovers the rules; with
it, the agent reads the rules in 60 seconds and applies them.
The cost (a few minutes per discovery, plus the discipline of
keeping the memory up to date) is paid in saved rediscovery
time many times over.

The pr-agent loop is the choice that scales review attention
across more PRs than a small team would otherwise handle. The
agent is not the reviewer of record; the agent is the second
pair of eyes that the human reviewer would otherwise have to
provide. The bandwidth gain is real.

## To go deeper

- The Claude Code docs at `docs.anthropic.com/claude/docs/`
  for the specific tool the auto-memory references; Cursor's
  docs at `docs.cursor.com/` for the equivalent in another
  shape.
- Anthropic's "Building effective agents" (web essay) for the
  general case.
- *The Programmer's Brain* (Hermans) for the cognitive
  background to why reading code matters more than writing it.
- Section 34 for what humans still do; section 35 for where
  this is going next.

---

# 34. What Humans Still Do

## What it is

The agent has gotten very good at writing code that compiles,
that follows conventions, and that passes the obvious tests. The
agent has not gotten good at deciding **which code to write**.
Architectural taste, product judgment, listening to a voice clone
and saying "that doesn't feel like Ian," reading a user's
feedback and choosing whether it reflects the next ten users or
just this one: these are the work humans still do, and the work
humans should still do.

This section is the inventory of that work in this project.
Section 33 covered how the team uses agents productively;
this one is the complement, the inventory of judgments the
agents are not asked to make.

## How it fits

Every architectural choice the Codex has documented started as a
human judgment. The decision to use Tauri instead of Electron
(section 04). The decision to use SQLite instead of a server
database (section 16). The decision to ship voice clones from a
single 15-second reference instead of training a per-voice model
(section 20). The decision to keep `gen/android/` and
`gen/apple/` regeneratable instead of hand-edited (sections 27,
28). The decision to keep the pack system as the architectural
centerpiece (section 10). Each is a judgment a human made,
explained, and committed to.

The agent contributes to executing each decision, sometimes with
significant volume. The agent does not get to undo any of them.

## Files and entry points

There is no specific file that holds "the human judgments." The
markers, throughout the codebase:

- `PIPELINE_STATE.md` at the repo root: documents the in-flight
  pipeline state, the calibration discoveries, the rules the
  human has set as non-negotiable (the "NEVER use --force on
  publish" list).
- `corpan/NARRATION_SYSTEM.md`'s "Why pre-generated audio, not
  on-device TTS" section: the seven-reason case for the
  pipeline's defining choice. This is a human framing.
- `corpan/APP_RELEASE_0_11_3.md`: the punch list, with
  human-set priorities and human-named tradeoffs.
- Every `Why we built it this way` section in this Codex: the
  rationale for each decision, written down so the next reader
  (human or agent) can see whether the rationale still holds.
- The auto-memory at
  `~/.claude/projects/.../memory/feedback_*.md`: feedback
  entries the user (Jeff) wrote because the agent's default
  behavior was wrong and the correction was non-obvious.

## How it works

### The judgments humans hold

A non-exhaustive list, drawn from the rest of the Codex:

- **What ships and what does not.** A pack's "ready" status is
  a human call. The validator's 12 checks (section 18) can pass
  and the audio can still feel wrong; the discipline is to
  listen.
- **Which features the app gains next.** The pack architecture
  (section 10) is what makes the next experience cheap; what
  the next experience **should be** is a Jeff call.
- **The voice character of a narrator.** Section 20 walks the
  Chatterbox cloning; the specific reference WAV and the
  per-language tuning are Jeff calls (with input from
  audition tests).
- **The visual identity of a pack.** Section 09 covers the
  styling stack; the specific palette (warm-earth-tones for
  Earthgate, the Stargate aesthetic family) is a design call.
- **The story a book tells.** Every book in `books/` is
  authored. Translations route through Claude subagents, but
  the source manuscript is human-authored.
- **The release decision.** When the app is "0.13.1 ready" is
  a Jeff call. The Codex documents the punch list (section
  27's reference to `APP_RELEASE_0_11_3.md`); the decision to
  declare done is not in the punch list.
- **The acceptable validator threshold.** The pipeline's
  thresholds (section 18's 12 checks) are calibrated against
  human listening. When the human ear says "this is fine" and
  the validator says "fail," the validator is recalibrated.
- **The rules the agent must follow.** The "no dashes in
  `tts.text` phonetic nudges" rule. The "do not edit
  `corpan/` from the codex worktree" rule. The "Cargo.lock is
  not committed" exception. Each is a human rule that the
  agent reads and obeys.
- **The trade between cost and quality.** The 64 kbps AAC
  choice (section 18). The "ship `medium` whisper for
  alignment, switch to `large-v3` for catalog-wide
  realignment" choice (section 21). Each balances a cost the
  human is willing to pay.
- **The decision to write something down.** When something is
  worth a comment in code, a doc, a memory entry, or a
  changelog entry. Sections 02 and 33 cover the practices; the
  decisions are case-by-case.

### The kinds of judgment

Three rough kinds:

- **Architectural**: "what shape should this take." The Tauri-
  over-Electron choice. The packs-over-monolith choice. The
  Spark-over-cloud-GPU choice. These are bets the team makes
  once and lives with for years.
- **Product**: "what should this do for the user." The "calm,
  earth-toned audiobook reader" identity of Earthgate. The
  "pass-the-device party game" framing of Parlometron. These
  are decisions about what the user is being offered.
- **Taste**: "how should this feel." The mastering chain
  parameters that make a voice sound like itself. The window
  size on desktop (1200 x 1000, not 800 x 600). The CSS
  custom-property defaults. These are decisions about
  experience quality.

The agent contributes to each kind in different ways: it can
prototype an architecture, draft a product spec, propose
several taste options. It does not get to settle any of them
without the human's nod.

### The trap: deferring judgment to the agent

The mistake to avoid: handing the agent a vague brief and
accepting whatever the agent produced because it compiled. The
agent will produce **something** for almost any input. The
question the human still has to answer is whether what was
produced is the right thing.

The mitigations the codebase encodes:

- **The CLAUDE.md / AGENTS.md files** name the conventions the
  agent should follow, so the agent's default is the project's
  default.
- **The reading-the-diff discipline** (section 33) ensures the
  human sees what the agent did before it becomes durable.
- **The auto-memory feedback entries** capture the "no, not
  like that" corrections so the agent does not re-make the
  same mistake.
- **The PR review by Skylar** is the second pair of eyes
  before the change reaches `upstream/main`.

Each is a small mechanism. Together they keep the human in
the loop where the judgment lives.

### The shift in skill emphasis

For the apprentice (the audience this manual is written for),
the skill emphasis has shifted in a specific direction:

- **Reading code** is more important than ever. The volume of
  generated code per hour has gone up; the comprehension rate
  has to keep up.
- **Writing prose** is more important than ever. The CLAUDE.md
  files, the comments, the auto-memory entries, the rationale
  paragraphs in `Why we built it this way` sections: all of
  these are what the agent reads next. Prose is the new
  scaffolding.
- **Naming things** is the central act of communication
  across the human-agent boundary. A well-named function
  steers the agent's next suggestion; a badly-named one
  doesn't.
- **Architectural pattern recognition** is what makes the
  judgments above repeatable. Knowing why Tauri-over-Electron
  was right here teaches you when the same family of choices
  is the right one elsewhere.

The skills that have **not** shifted: tracing a bug to its
cause, profiling a slow path, listening to a voice clone and
hearing the seam. These are the work humans still do because
they are the work humans are still better at.

## Common operations

1. **Make an architectural decision.** Write the decision
   down. Put it in a doc file (`PIPELINE_STATE.md`,
   `NARRATION_SYSTEM.md`, this Codex). Include the why and
   the costs.
2. **Correct an agent's default.** Add a feedback entry to
   `~/.claude/projects/.../memory/feedback_*.md`. Include why
   the correction is non-obvious.
3. **Audition a creative choice.** Listen to the voice. Read
   the prose. Look at the screenshot. The agent can produce
   variants; the human picks.
4. **Set a non-negotiable rule.** Write it in the relevant
   AGENTS.md or CLAUDE.md. Mark it clearly as non-negotiable.
   The agent reads it on every session.
5. **Resolve a conflict between agent suggestion and human
   instinct.** Trust the instinct; investigate to confirm.
   Update the memory or the rule if the investigation
   yields a generalizable lesson.
6. **Decide that a change is good enough to ship.** Read the
   diff. Test the change. Listen to or look at the output.
   Ship.

## Why we built it this way

The codebase invests heavily in agent-facing prose (CLAUDE.md,
AGENTS.md, comments, auto-memory) because the prose is where
the human's judgment lives. The agent's contribution is the
volume of code; the human's contribution is the direction. The
prose is what carries the direction across sessions, across
agents, across years.

The discipline of writing down rationale in `Why we built it
this way` sections (and in the equivalents throughout the
codebase) is the smallest investment that keeps the
architecture from drifting. A decision that is recorded can
be re-evaluated when conditions change; a decision that lives
only in the original author's head cannot. The Codex itself
is the bet that the rationale is worth writing down at the
scale of the whole system.

The acknowledgement that humans are still better at some
things is not a defensive claim; it is the basis for working
together productively. A human who pretends the agent is
better at every kind of work will hand off judgments the
agent cannot make. An agent that pretends the human's
judgment is always right will not flag the cases where the
human has missed a relevant constraint. The honest division
of labor (humans for direction and judgment, agents for
volume and execution) is what makes the partnership work.

The apprentice the Codex is written for inherits both halves
of this work. The skill set is "read code, write prose, name
things, recognize patterns" plus "trace bugs, listen
carefully, hold the architecture in mind." Section 35 closes
this part of the manual with a brief look at what comes next.

## To go deeper

- *The Pragmatic Programmer* (Hunt and Thomas) for the case
  that prose-around-code is part of code; this codebase is a
  direct expression of that case.
- *Designing Data-Intensive Applications* (Kleppmann) for the
  systems-judgment vocabulary the Codex's architectural
  decisions draw on.
- *The Mythical Man-Month* (Brooks) for the second-system
  effect and the conceptual integrity argument that
  underlies this section's "judgment, not volume" framing.
- Section 33 for the agent-facing side of the same
  conversation; section 35 for what changes next.

---

# 35. The Near Future

**Snapshot at 2026-05-29.** This section is dated speculation,
explicitly. The other sections of the Codex describe the system
as it stands; this one describes where the team's attention
points next. Things move; the speculation will age. Read the
date at the top before trusting the predictions below.

## What it is

A small set of directions the project is already pointed in,
plus a smaller set of larger bets that are plausibly the next
phase. Each entry is one or two paragraphs; each is qualified
with what would have to be true for it to happen.

## How it fits

The Codex describes a system in motion. Every other section
captures a moment; this one captures the direction of motion.
The intended reader is a Jeff or a Skylar coming back in six
months with the question "did we end up doing what we said we
would?"

## How it works

### Near (next few months)

**Pronunciation coach matures.** Parlometron (v0.13.x) shipped
the pass-the-device party game on top of the existing
pronunciation infrastructure. The next several releases tune
the scoring per language, expand the language set beyond the
current 51, and ship the bigger Whisper models on devices
that have the memory headroom. The catalog-side audit (which
voices, which models, which prompts) is partly automated, but
the per-language tuning is human work.

**More books, more languages.** The current shipped scale is
seven books across ten languages (per
`NARRATION_SYSTEM.md`). The pipeline is engineered for the
order of 50+ books across 25+ languages; the next several
months are about adding both. The Fascinating Curiosities
twelve-volume run, the Tolstoy short stories, the Soccer
series, Genesis: each is queued.

**The pack catalog grows.** New reading-style packs (Stargate
Reader is shipping; Earthgate continues to grow; new ones in
the same `@shared/catalog` shell are queued). New non-reading
packs (Melopán's music sandbox is on a branch; Quest-Ear's
v0.4.0 Rat King final boss is uncommitted per auto-memory).
Each new pack ships as its own changelog (section 02); the
catalog absorbs them.

**Apple Vision Pro / spatial computing.** Tauri's iOS path
runs on visionOS. The question is whether the reading
experience makes sense in a spatial context; the answer is
probably yes for the long-form reader and probably no for the
pronunciation coach (which wants a face-forward microphone).
No work scheduled; pencil only.

**Web Codex.** This Codex itself shipping as a browsable
web artifact at encorpora.io or under a sibling subdomain. The
current shape (markdown files in `codex/`) is already
browsable on GitHub; a static-site build (eleventy, Astro, or
Vite-MDX) is the next obvious step. Trivial cost; meaningful
reach.

### Medium-near (six to eighteen months)

**Device-to-cloud user state.** Section 26 flagged the
deliberate absence of cloud sync. The day the second-device
cost outgrows the architectural simplicity of "no backend" is
the day to add minimal user state sync. The minimum viable
shape is anonymous-account-per-install with a server that
stores the settings store, the history store, and the
installed-pack list. Identity probably ties to Apple ID or
Google sign-in; the Corpora platform code (the sibling repo
the encorpora README references) may absorb this work.

**A real `Brewfile`.** Section 32 noted the absence. A
committed `Brewfile` at the repo root reduces the fresh-machine
setup time meaningfully and documents the system-binary
dependency surface in one place. Small change, real value.

**Deterministic `gen/` rebuilds.** Section 27 flagged the
"longer-term ideal" of gitignoring `gen/apple/` and
`gen/android/` once the regen scripts are deterministic
across machines. The prerequisites are several specific
template-layer fixes (the iOS entitlements toggle through
project.yml, the Android manifest merge for BILLING). When
those land, the `.gitignore` move is mechanical.

**Catalog-versioned pack delivery.** Today, when a pack
publishes a new version, the catalog is updated and existing
installs continue to play the old version until the user
reinstalls. A future shape: the catalog declares "the current
canonical version is X; you have Y," and the app prompts the
user to update at a natural moment. This is design work as
much as engineering work; the right place for the prompt is
not obvious.

### Larger bets (twelve to twenty-four months)

**On-device TTS catches up.** Section 18's "Why pre-generated
audio, not on-device TTS" case held in 2024 and holds in
2026. It will not hold forever. When on-device voice cloning
becomes shippable (smaller models, better quality), the
pipeline will not become obsolete (the QA bar is the QA bar)
but the runtime mix may shift. Some content may be
pre-generated; some may be on-device; the line moves.

**The Corpora platform absorbs more.** The README's
"experiments graduate" framing has been the working model
since the start. Several of the in-encorpora components
(`tauri-plugin-iap`, parts of the catalog, the audio engine in
`@shared/audio`) are stable enough to graduate. When they do,
the boundary between encorpora and corpora shifts; the Codex
acquires a sibling document covering the stable side.

**A Codex of Codexes.** This document is one specific
manual for one specific codebase. The pattern (a manual that
braids reference and education) is portable; the team may
find itself wanting a parallel Codex for the Corpora platform
when that codebase is mature enough to deserve one.

**The agent era keeps changing.** Whatever the agents are
doing in eighteen months will be different from what they
are doing today. The patterns the codebase invests in
(CLAUDE.md, AGENTS.md, auto-memory, decision logs) are
betting on the shape of "agents read prose, humans write
prose, humans hold judgment" being durable across model
generations. If the bet is right, the patterns scale; if it
is wrong, the next Codex will document a different shape.

## Common operations

The "common operations" idea does not quite apply to a
prediction section. The closest is:

1. **Revisit this section.** Six months from this date,
   read it back. Note what came true, what did not, what
   surprised. The exercise calibrates future predictions.
2. **Add a new prediction.** When a Jeff or a Skylar says
   "we're going to do X next quarter," write it here with the
   date and the qualifier.
3. **Remove a stale prediction.** When something here turns
   out to be wrong (the timeline slipped, the bet did not pay
   off), say so explicitly; do not silently delete.

## Why we built it this way

A dated speculation section is the smallest mechanism for
keeping the manual honest about its limits. The other
sections claim to describe the system; this one claims to
describe one moment in the team's attention. Mixing the two
would let speculation rot the rest; separating them lets the
speculation be useful without being mistaken for
documentation.

The convention to mark the date and qualify each prediction is
the equivalent of "Why we built it this way": a prediction
with its conditions attached can be re-evaluated when the
conditions change. A prediction without conditions is just an
opinion frozen in time.

The decision to keep this section short (and to keep the
predictions modest) is deliberate. Long lists of "what we
might do" rot fastest; short lists of "what we are actually
about to do" age better. When in doubt, prefer the second
shape.

## To go deeper

- Section 36 for the dated history of what the system has
  done; this section pairs with it.
- The auto-memory at
  `~/.claude/projects/.../memory/` for the team's current
  per-pack work (Melopán's status, Quest-Ear's branch state),
  which is the freshest signal of where the next few weeks
  will go.
- `PIPELINE_STATE.md` at the repo root for Skylar's current
  view of the narration pipeline's state and priorities.

---

# 36. Changelog of the System

**Snapshot at 2026-05-29.** This section summarizes architectural
changes to the system over the last 90 days, written from the
perspective of "what shape did the system change into." Per-unit
changelogs (sections 02, 10, 17) carry the granular history;
this section reads the granular history at a different
altitude.

The cutoff is `2026-02-28` to `2026-05-29` against
`upstream/main`. Snapshots like this one rot; treat the entries
as a historical record rather than as live state.

## What it is

A dated, prose-shaped account of the largest architectural
shifts in the last 90 days. Each entry names the change, the
month it landed, the PRs that carried it, and the larger
context.

## How it fits

This section pairs with section 35 (The Near Future): one
records what happened, the other speculates about what
happens next. Together they bracket the static-system view
the rest of the Codex documents.

## Files and entry points

- `upstream/main`'s `git log` for the period
  `2026-02-28..2026-05-29`. The reference command:
  `git log --since='2026-02-28' --until='2026-05-29' --oneline upstream/main`.
- Per-pack `CHANGELOG.md` files for the unit-level
  granularity.
- `corpan/corpan-app/CHANGELOG.md` for the app's per-version
  detail.
- `RELEASE_NOTES_*.md` files at the repo root for the per-
  release user-facing copy.
- `PIPELINE_STATE.md` for Skylar's pipeline-side dated record.

## How it works

The picture, in chronological order from oldest to newest in
the window:

### IAP rewrite for App Review (March 2026)

`#0.11.7 - IAP rewrite for App Review resubmission`
(`7d4076b0`), preceded by several IAP-tightening releases
(`0.11.5`, `0.11.6`). The work was the response to an Apple
review rejection that required restructuring the IAP flow,
hardening the lifecycle around purchase and restore, and
clarifying the receipt-validation path. The plugins involved
were `tauri-plugin-iap` and `tauri-plugin-subscriptions`. The
investment paid off in a successful resubmission and in the
discipline (per the IAP runbook at
`corpan/infra/IAP_SETUP_RUNBOOK.md`) that subsequent IAP
changes are still expected to follow.

### Reader catalog v2 and narrators (March 2026)

`#233 Add Narrators to readers catalog and World Radio pack`
(`6647ed4a`). The catalog model shifted from a flat list of
narrations to a narrator-first shape: a `Character` model
with voice profiles, books they have narrated, languages they
speak. The catalog UI rebuilt around it. This is the change
that gave `@shared/catalog/src/types.ts` (section 13) the
`Character`-and-`BookEntry`-and-`Narration` shape it has
today. Earthgate Reader and Stargate Reader adopted the new
catalog in the same window.

### Analytics hardening for Tauri WKWebView (March 2026)

`#231 Corpan: anon analytics and telemetry for books`
(`d8188690`) plus the follow-up `analytics: harden CORS for
Tauri WKWebView, drop subdivision geo, add generic track()`
(`6e01f026`). The CORS work was the response to Tauri's
WKWebView origin shape being subtly different from a browser's;
the geo-subdivision drop was a privacy-side choice. The result
is that the app emits anonymous analytics with no PII to the
project's analytics endpoint, with the per-event shape
documented for the next person adding a new event.

### Corpus slim and language expansion (early April 2026)

`#232 Corpan Slim corpus to 10k phrases + add 9 languages (he,
sv, fi, nl, sw, no, da, el, ms)` (`c3b16da9`). The bundled
SQLite (section 16) shrank from a long tail of low-quality
phrases to ~10,000 high-quality ones; nine languages joined
(Hebrew, Swedish, Finnish, Dutch, Swahili, Norwegian, Danish,
Greek, Malay). The binary size dropped meaningfully; the
user-visible quality of the random-entry flow rose.

### World Radio (April 2026)

`#237 Corpan World Radio - try native implementation over
browser` (`d0fb4518`), then `#238 Corpan 0.12.0 - World radio
native streams` (`084c97bd`). World Radio is the pack that
streams live radio stations from around the world; the early
implementation used the WebView's built-in HTML5 audio,
which fell over on lock-screen transitions and on background
playback. The native implementation lives in the
`tauri-plugin-radio-stream` plugin and routes through the
device's audio session, which unlocks proper background
playback and lock-screen integration.

### Pronunciation Coach on Android CPU with whisper.cpp (April 2026)

`#250 Almost 0.12.6 - Pronunciation coach on Android CPU,
whisper.cpp` (`c66d5d77`). The Android side of the
pronunciation coach went from the SFSpeechRecognizer-style
fallback to whisper.cpp running on CPU with NEON
optimizations. Quality improved noticeably; the configuration
documented in section 21 dates from here.

### DGX catalog (April 2026)

`#249 DGX catalog` (`c7689860`). The catalog publisher
(section 24's `catalog.json` mechanics) was rewritten to be
driven by the DGX Spark's `ttsctl publish` step rather than
by manual catalog edits. Publishing a new narration became a
single command from the Spark; the catalog stays consistent
without a separate sync.

### Earthgate and Hanzipan polish (April 2026)

`#248 Hanzipan, earthgate touches, controls chapter/title
display earth/star` (`17943fd6`). Hanzipan (the Mandarin
character pack) shipped a polish round; Earthgate Reader
tightened the chapter/title display in the transport bar
(section 15). The "earth/star" reference in the title is to
the dual-reader split: the same chapter-display logic ships
in both Earthgate and Stargate, themed per pack.

### Parlometron (May 2026)

`#252 0.13.0 corpan + PARLOMETRON` (`6cb89abf`),
`#253 Corpan 0.13.X - PARLOMETRON GAME` (`d076f112`),
`#255 parlometron, start >0.13.1 onboarding and phrase pack
architecture` (`ecaa596c`). Parlometron is the
pass-the-device pronunciation party game, layered on top of
the pronunciation coach's STT (section 21) and the phrase
pack architecture that started in this window. The release-
notes copy in `RELEASE_NOTES_0.13.1.md` carries the headline
in 30+ locales: "Parlometron, solo practice plus a pass-the-
device party game (2-8 players), 51 languages, on-device
Whisper scoring."

### Moonshot 15 and Corpan 0.15.10 (mid-to-late May 2026)

`#256 Moonshot 15 plus` (`a8b0bc30`),
`#259 Corpan 0.15.10` (`d820a11f`). The 0.15.x line is the
current shipped one. The "Moonshot 15 plus" PR is the
in-window pack-architecture push (the phrase-pack model that
section 14 covers); the per-version patch releases are the
continued polish.

## How the architectural surface changed

Three larger shifts visible across the window:

- **The catalog became narrator-first.** The shape that
  section 13's `appShell.ts` orchestrates today is the
  artifact of the March catalog v2 rewrite. The
  `Character` / `VoiceProfile` / `BookEntry` model in
  `shared/catalog/src/types.ts` is the catalog's contract.
- **The audio runtime became fully native.** World Radio's
  native streams, the audio-keepalive plugin work, the
  lock-screen integration, the `mediaSessionAnchor` and
  `nativeKeepAlive` modules in `@shared/audio`. The runtime
  no longer relies on the WebView's audio facilities for
  anything load-bearing.
- **The on-device pronunciation surface matured.** The STT
  plugin (sections 04, 05, 21), Parlometron's party-game
  framing, the per-language tuning. From "an experimental
  pack" to "a primary user surface" in 90 days.

## Common operations

1. **Regenerate this section.** From the encorpora repo:
   `git log --since='90 days ago' --pretty=format:'%h %s'
   upstream/main`. Cluster the commits by week and by theme;
   write a paragraph per cluster.
2. **Trace a per-version detail.** Open the relevant
   `CHANGELOG.md` for the unit (the app's at
   `corpan/corpan-app/CHANGELOG.md`, a pack's at
   `corpan/packs/<pack>/CHANGELOG.md`). The PR numbers in
   this section's prose are the bridge.
3. **Audit which architectural choices changed.** Reread the
   "How the architectural surface changed" subsection;
   check each against the corresponding deep-dive section's
   "Why we built it this way." Any drift is the place to
   update.

## Why we built it this way

A 90-day rolling window is the smallest interval over which
the architectural changes are large enough to summarize
prosaically. A weekly snapshot would mostly capture polish;
a yearly snapshot would lose the texture. The 90-day cut is
also a comfortable cadence for the human writing the
section to re-read the previous version and catch what
slipped.

The dated header at the top is the same discipline section
35 uses. A historical record without a date is a claim about
the present that the reader will misread.

The structure (chronological clusters, then "How the
architectural surface changed," then the operations) is the
shape that pays off when the reader comes back six months
later and asks "what was the big shift in April." The
clusters answer that question; the architectural-surface
summary closes the loop.

## To go deeper

- `git log` against `upstream/main` for the granular
  history; PR numbers in this section are the entry points.
- Each per-unit `CHANGELOG.md` for the unit-level
  granularity that this section omits.
- `RELEASE_NOTES_*.md` files at the repo root for the
  user-facing per-release copy in 30+ locales.
- `PIPELINE_STATE.md` for Skylar's narration-pipeline-side
  history during the same window.
- Section 35 for the speculation paired with this section's
  history.

---

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

---

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
- No `§` symbols. "Section N" or just `N` in prose.
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

---

# Appendix C. Commands

The 30-or-so commands run most often, grouped by purpose.

## Setting up a fresh machine

- `brew install git-lfs jq ffmpeg awscli xcodegen blender node@20`
  installs the system binary layer (section 32 notes the
  absence of a Brewfile).
- `git clone https://github.com/Umanistan/encorpora.git` clones
  the fork (section 03).
- `git remote add upstream https://github.com/corpora-inc/encorpora.git`
  adds the team remote.
- `git remote set-url --push upstream DISABLED` disables the
  push URL on upstream (section 03).
- `git lfs install && git lfs pull` hydrates LFS-tracked
  files including the bundled SQLite (section 03).
- `./web/scripts/setup.sh` bootstraps the public-site
  per-project npm dependencies.
- `./corpan/infra/hydrate-voices.sh` pulls voice clone WAVs
  from S3 (section 24).
- `./corpan/infra/hydrate-audio.sh` pulls narration audio from
  CloudFront (section 24).

## Running things locally

- `npm run dev` from the repo root composes the marketing
  site, the Pages site, and the reference packs at port 8000
  (section 02).
- `cd corpan/corpan-app && npm run tauri dev` runs the app
  with hot reload (section 04).
- `cd corpan/corpan-app && npm run tauri ios dev` runs the
  app in the iOS simulator (section 27).
- `cd corpan/corpan-app && npm run tauri android dev` runs the
  app on the Android emulator or device (section 28).
- `cd corpan/packs/<pack> && npm run dev` runs a pack
  standalone in a browser tab (section 11).
- `cd corpan/packs/<pack> && npm run dev:watch` rebuilds the
  pack into the live site on every change (section 11).

## Type checking and building

- `cd corpan/corpan-app && npm run tsc` type-checks the React
  side (section 07).
- `cd corpan/corpan-app/src-tauri && cargo check` type-checks
  the Rust side (section 05).
- `cd corpan/corpan-app && npm run tauri build` builds a
  desktop release (section 29).
- `cd corpan/corpan-app && npm run tauri ios build` builds an
  iOS archive (section 27).
- `cd corpan/corpan-app && npm run tauri android build`
  produces an Android AAB (section 28).
- `cd corpan/corpan-app && ./scripts/ios-gen.sh --clean`
  regenerates the iOS Xcode project (section 27).
- `cd corpan/corpan-app && ./scripts/patch-android.sh` patches
  the generated Android Gradle config (section 28).
- `cd corpan/packs/<pack> && npm run pack:all` builds and
  zips a pack for offline install (section 11).

## Publishing

- `aws s3 sync voices/data/ s3://corpan-prod/sources/voices/data/
  --profile corpan-publisher` syncs voice references
  (section 24).
- `./corpan/infra/sync-marketing-to-s3.sh` syncs marketing
  assets (section 24).
- `./corpan/infra/captures/build-and-upload.sh <raw.mov>`
  builds a capture and uploads to YouTube (section 25).
- `ttsctl publish` (on the Spark) publishes a narration
  pack, including S3 upload and CloudFront invalidation
  (section 22).

## Inspection

- `git log --oneline -20 upstream/main` shows the recent
  shape of the team repo (section 03).
- `git worktree list` shows the active worktrees
  (section 03).
- `find . -name 'segments.json' -print` enumerates books
  with the new segments format (section 17).
- `curl -s https://d38iwc9748jekz.cloudfront.net/catalog.json | jq .`
  inspects the live catalog (section 24).
- `sqlite3 corpan/dja/release.sqlite3 ".schema"` shows the
  phrase corpus schema (section 16).
- `ffmpeg -i <segment>.m4a -af ebur128 -f null -` measures a
  segment's LUFS (section 18).

## Data inspection

- `jq '.segments[0]' segments.json` shows the first segment
  of a book (section 17).
- `jq '.narrations[] | {bookId, language, version}' catalog.json`
  lists what is published (section 24).

## Recovery

- `git lfs install && git lfs pull` after a fresh clone
  hydrates LFS files (section 03).
- `git reflog` recovers a ref that was overwritten
  (section 03).
- `./corpan/infra/hydrate-{audio,voices,marketing}.sh`
  rebuilds local working state from S3 (section 24).

That is the 30. Each does one thing. Each is documented in
the section the parenthetical names.

---

# Appendix D. Reading List

Books, papers, and talks the rest of the Codex points at. Grouped
by topic. Each title is annotated with the section that names it.

## Foundations

- Steve Klabnik and Carol Nichols, *The Rust Programming
  Language* (free at `doc.rust-lang.org/book/`). Section 05.
- Jon Gjengset, *Rust for Rustaceans*. Section 05.
- Dan Abramov, *Just JavaScript* (free at
  `justjavascript.com`). Section 06.
- The official React docs at `react.dev`. Section 06.
- The TypeScript handbook at
  `typescriptlang.org/docs/handbook/2/`. Section 07.
- Matt Pocock, *Total TypeScript* (free tier at
  `totaltypescript.com`). Section 07.
- Scott Chacon and Ben Straub, *Pro Git* (free at
  `git-scm.com/book/`). Section 03.

## Systems and architecture

- Nisan and Schocken, *The Elements of Computing Systems*.
  Codex voice reference.
- Remzi and Andrea Arpaci-Dusseau, *Operating Systems:
  Three Easy Pieces* (free at
  `pages.cs.wisc.edu/~remzi/OSTEP/`). Codex voice reference.
- Robert Nystrom, *Crafting Interpreters* (free at
  `craftinginterpreters.com`). Codex voice reference.
- Andrew Hunt and David Thomas, *The Pragmatic Programmer*.
  Codex voice reference; section 34.
- Martin Kleppmann, *Designing Data-Intensive Applications*.
  Section 34.
- Joel Spolsky, "Things You Should Never Do, Part I" (web
  essay). Section 02.

## TTS, STT, and audio

- Alec Radford et al., *Robust Speech Recognition via
  Large-Scale Weak Supervision* (the Whisper paper, on arXiv).
  Section 21.
- `stable-ts` on GitHub (`jianfch/stable-ts`). Section 21.
- `whisper.cpp` on GitHub (`ggerganov/whisper.cpp`). Section 21.
- `chatterbox-tts` on GitHub (Resemble AI). Section 20.
- `tonejs.github.io` docs. Section 23.

## Frameworks

- Tauri 2 docs at `v2.tauri.app`. Section 04.
- Vite docs at `vite.dev`. Section 08.
- Tailwind CSS v4 docs at `tailwindcss.com/docs/`. Section 09.
- shadcn/ui at `ui.shadcn.com`. Section 09.
- Radix UI primitives at `radix-ui.com/primitives`. Section 09.
- Babylon.js docs at `doc.babylonjs.com`. Section 23.
- Phaser docs at `phaser.io/docs`. Section 23.
- Django docs at `docs.djangoproject.com`. Section 19.

## Infrastructure

- AWS S3 and CloudFront docs at `docs.aws.amazon.com/s3/` and
  `docs.aws.amazon.com/cloudfront/`. Section 24.
- YouTube Data API v3 docs at
  `developers.google.com/youtube/v3`. Section 25.
- Tailscale docs at `tailscale.com/kb`. Section 22.

## Toolchain

- *The Linux Command Line* (Shotts), free at
  `linuxcommand.org/tlcl.php`. Section 31.
- The Cargo book at `doc.rust-lang.org/cargo/`. Section 32.
- `pip` docs at `pip.pypa.io/en/stable/` and `uv` docs at
  `docs.astral.sh/uv/`. Section 32.

## Apprenticeship

- Frederick Brooks, *The Mythical Man-Month*. Section 34.
- Felienne Hermans, *The Programmer's Brain*. Section 34.
- Donald Knuth, *Literate Programming*. The wider tradition
  this Codex inherits from.
- *Things by Their Right Names* (the working title of the
  practice that says: name files, name functions, name
  patterns, name decisions). The Codex itself is one
  instantiation.

## Apple and Google platforms

- Apple's "App Distribution" docs at
  `developer.apple.com/documentation/Xcode/distributing-your-app-for-beta-testing-and-releases`.
  Section 27.
- XcodeGen at `github.com/yonaskolb/XcodeGen`. Section 27.
- Tauri's Android docs at
  `v2.tauri.app/develop/mobile/android/`. Section 28.
- Android WebView docs at
  `developer.android.com/reference/android/webkit/WebView`.
  Section 28.

## Agent era

- Anthropic's Claude Code docs at
  `docs.anthropic.com/claude/docs/`. Section 33.
- Cursor docs at `docs.cursor.com/`. Section 33.
- Anthropic's "Building effective agents" essay. Section 33.

## Color and design

- "OKLCH in CSS" at `oklch.com`. Section 09.

---

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

---

