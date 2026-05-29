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
