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
