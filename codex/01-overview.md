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
