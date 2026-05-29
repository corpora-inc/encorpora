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
