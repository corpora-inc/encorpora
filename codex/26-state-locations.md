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
