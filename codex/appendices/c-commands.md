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
