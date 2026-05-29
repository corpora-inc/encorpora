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
