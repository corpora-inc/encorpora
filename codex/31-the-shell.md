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
