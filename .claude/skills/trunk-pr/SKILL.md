---
name: trunk-pr
description: The encorpora worker loop as an executable procedure — fetch, worktree, implement, verify, commit, push, open the PR, self-review adversarially, fix, merge on green, fast-forward local main. Use for every change that lands on main, and whenever you are about to run `git worktree add`, `gh pr create`, or `gh pr merge` in this repo.
---

# Trunk PR

Trunk-based development is the law here as of 2026-07-25. One change, one
worktree, one PR, squash-merged to `main`. Merges happen constantly, which is
what makes each one small enough to review.

The old "long-lived integration branch, big-bang squash" methodology is
**dead**. Do not restore it, do not cite it, do not open a branch that
accumulates weeks of work.

### Read this too

[`FAILURE-MODES.md`](FAILURE-MODES.md) — the ways this loop goes wrong **while
looking like it went right**. Every entry happened here. If you are about to
`reset --soft`, prune a worktree, trust a single green test run, take over from
a dead agent, or hand a recipe to several agents at once, the answer is in
there. It ends with a copy-pasteable preflight and postflight.

### Relationship to `AGENTS.md`

`AGENTS.md` owns the process: the board, the gates, the pack checklist, the
fail-forward policy. **This file owns the procedure**, and it wins wherever the
two overlap — `AGENTS.md` predates the 2026-07-25 trunk law and still carries
two instructions that are now wrong:

| `AGENTS.md` says | Correct today |
| --- | --- |
| `git worktree add ../wt-<issue> …` | worktree goes at `$WT_ROOT/<branch>`, outside the repo, named for the branch (§0) |
| "**Auto-merge.** Enable it (`gh pr merge --squash --auto`)" | **do not merge**; the CTO merges (§10) |

`AGENTS.md` also states the pack floor as "Corpán 0.19.2 today"; it is **0.20.6**
(`corpan/corpan-app/src-tauri/tauri.conf.json`). Reconciling `AGENTS.md` is
tracked separately — until it lands, follow this file.

## 0. Ground rules

- **Local `main` changes by pull/fast-forward and by nothing else.** That is the
  rule the rest of this file exists to serve. Every change reaches it the same
  way: worktree → remote branch → PR → squash-merge → pull the new `origin/main`
  down as a fast-forward. The primary checkout should sit on a clean `main` at
  all times — no edits, no commits, no `checkout -b`, nothing uncommitted.
  If `git merge --ff-only origin/main` ever refuses, that is the alarm: the
  checkout has diverged and must be investigated, never forced.
- The primary checkout is **read-only**. Read from it, run read-only git in it,
  never edit or check out in it.
- Every worktree goes **outside** the repo directory, at `$WT_ROOT/<branch>`.
  Worktrees nested inside the repo bloat every search and get left behind (27
  are nested there today).
- Re-base a branch with `git rebase origin/main`. **Never `git reset --soft
  origin/main`** — when `main` has moved it re-parents your commit onto the new
  tip while keeping the old tree, silently reverting everything that landed in
  between, with no conflict and no warning. Catch it before pushing:
  `git -C "$WT" diff --name-only origin/main...HEAD` must list only your files.
- Path-gate anything you add to CI. That is what makes constant merging safe in
  a monorepo.

Derive the paths; do not hardcode a home directory. These are the same two the
`worktree-guard` hook computes, and they resolve correctly from inside a
worktree as well as from the primary checkout:

```bash
REPO="$(dirname "$(cd "$(git rev-parse --git-common-dir)" && pwd -P)")"
WT_ROOT="$(dirname "$REPO")/wt"
```

## 1. `git -C` discipline — read this before your first git command

**The shell's working directory resets between tool calls.** A command shaped
like

```bash
cd "$REPO" && git checkout -b feature   # WRONG
```

operates on the **primary checkout**, not on your worktree, even if a previous
call left you in the worktree. This has caused a real incident: work committed
onto the primary checkout, off any branch anyone was tracking.

Use an explicit `-C` on every single git invocation:

```bash
WT="$WT_ROOT/<branch>"
git -C "$WT" status
git -C "$WT" add -A
git -C "$WT" commit -m "..."
```

Same for `gh`: `gh -R corpora-inc/encorpora ...` or run it with `--repo`.

## 2. Claim

One issue, moved to Doing. **WIP = 1.** You own it to done. No priorities, no
estimates, no `area:*`/`risk:*` label namespaces — labels are near-zero here on
purpose (`AGENTS.md`).

## 3. Worktree

```bash
BR=<verb>-<short-slug>            # e.g. fix-catalog-dedupe, add-stargate-zh
WT="$WT_ROOT/$BR"                 # $REPO/$WT_ROOT from §0

git -C "$REPO" fetch origin
git -C "$REPO" worktree add -b "$BR" "$WT" origin/main
```

Branch off `origin/main`, never off local `main` — local can be behind.

Disk: a fresh worktree is ~9.7k files, and each `cargo build` inside one grows
its own `target/`. `corpan/corpan-app/src-tauri/target/` alone is ~148G and the
repo-root `target/` is ~52G. Remove your worktree when the PR merges.

## 4. Implement

Stay inside your declared file scope. If another file must change, say so in the
handoff rather than changing it — a parallel agent probably owns it, and a
conflict costs both of you a rebase.

## 5. Verify before you push

Run the gates that apply to what you touched, and record the exact commands and
their output — the PR body needs them.

- TypeScript app or pack: `npm test`, `npm run tsc`, `npm run build` in that
  package.
- Rust / `src-tauri` / plugins: use the `native-gatekeeper` agent. `cargo fmt
  --check`, `clippy -D warnings`, a cross-compile check, `links =` uniqueness,
  and the `[patch.crates-io]` graph assertions.
- Workflow YAML: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/<f>.yml'))"`,
  or `actionlint` if installed.
- Shell: `bash -n <script>`, then actually run it.
- New user-visible strings: present in **every** locale under
  `corpan/corpan-app/public/locales/`. `npm run check:i18n` runs inside `npm run
  build` and fails the build on any missing key.

## 6. Diff size — there is no cap; do not split for one

**A PR is never too large for the gate.** `adversarial-review` splits the diff
on `diff --git` boundaries into budget-sized chunks, runs every lens over every
chunk, unions the findings, and asserts `"".join(chunks) == diff` **before it
makes a single model call**. A file bigger than one chunk is split, not
truncated and not rejected. `MAX_CHUNK_CHARS` (default 200 000) is a per-chunk
budget, not a limit on your PR.

Observed: a 281 638-char diff reviewed as "2 chunk(s) of <= 200000; every lens
read 100% of that diff, 0 chars dropped".

This section used to say the opposite, and the old advice is what the sticky
review comment now disproves on every large PR. The behaviour it warned about
was real — the gate once truncated at 200 000 bytes and still reported
`success`; PR #521 was 850 261 bytes across 186 files and the model saw 67 of
them — but that hole was closed by chunking, not by asking authors to split.
`MAX_DIFF_BYTES` no longer exists in the script.

Split a PR when it does more than one thing, never to hit a byte count.

`hygiene` also fails any added non-LFS file over 5 MiB.

## 7. Commit and push

Conventional commit, imperative, honest. No emoji.

```bash
git -C "$WT" add -A
git -C "$WT" status --porcelain --untracked-files=all # confirm exactly what you intend
git -C "$WT" commit -m "fix(catalog): dedupe entries by id before install"
git -C "$WT" push -u origin "$BR"
```

Never commit a keystore, `.p8`, service-account JSON, issuer id, key id, or
token. The repo is public.

## 8. Open the PR

```bash
gh pr create --repo corpora-inc/encorpora --base main --head "$BR" \
  --title "..." --body-file <path>
```

The body follows `.github/pull_request_template.md`: **What / Why / Blast
radius / Proof**. Proof is the commands you ran and their real output — not
"tests pass". Fill the blast-radius checklist honestly; it is the part a
reviewer cannot reconstruct from the diff.

## 9. Self-review, then fix

Run the `adversarial-reviewer` agent over `origin/main...HEAD` before you ask
for the merge. It mirrors CI's three lenses (correctness, security,
pack-compat). Only HIGH severity blocks; the gate **fails closed** if the lenses
cannot run, so a green check means the review really happened.

Fix findings on the branch and push again. The sticky review comment updates in
place.

## 10. Merge on green

Required checks on `main`: **`ci-gate`**, **`adversarial-review`**, **`hygiene`**.
The branch must be up to date with `main` (strict), and history is linear —
merges land as **squash** commits titled `Subject (#NNN)`. Never
`gh pr merge --merge`.

`main` is protected by ruleset `11721169` with no bypass actors; the merge queue
is ruleset `18008260`.

**Do not merge unless you have been told to.** In an orchestrated run the CTO
merges. If you are the one merging, keep the branch fresh first:

```bash
git -C "$WT" fetch origin
git -C "$WT" merge origin/main       # or rebase; keep it small and current
git -C "$WT" push
```

## 11. Prove the work is safe, then clean up immediately

After GitHub confirms the PR was squash-merged, verify the worktree before
deleting anything. Only the worktree's owning agent may run this, after every
build, dev server, emulator, and other process using it has exited. Run the
block from anywhere inside the worktree being removed:

```bash
set -euo pipefail
WT="$(git rev-parse --show-toplevel)"
COMMON_DIR_RAW="$(git -C "$WT" rev-parse --git-common-dir)"
COMMON_DIR="$(cd "$WT" && cd "$COMMON_DIR_RAW" && pwd -P)"
REPO="$(dirname "$COMMON_DIR")"
BR="$(git -C "$WT" branch --show-current)"
test "$WT" != "$REPO"
test -n "$BR"
ORIGIN_URL="$(git -C "$REPO" remote get-url origin)"
PUSH_URL="$(git -C "$REPO" remote get-url --push origin)"
case "$ORIGIN_URL" in
  https://github.com/corpora-inc/encorpora|https://github.com/corpora-inc/encorpora.git|\
  git@github.com:corpora-inc/encorpora|git@github.com:corpora-inc/encorpora.git) ;;
  *) printf 'unexpected origin URL; refusing cleanup\n' >&2; exit 1 ;;
esac
case "$PUSH_URL" in
  https://github.com/corpora-inc/encorpora|https://github.com/corpora-inc/encorpora.git|\
  git@github.com:corpora-inc/encorpora|git@github.com:corpora-inc/encorpora.git) ;;
  *) printf 'unexpected push URL; refusing cleanup\n' >&2; exit 1 ;;
esac
git -C "$REPO" fetch origin
PRIMARY_BRANCH="$(git -C "$REPO" branch --show-current)"
PRIMARY_STATUS="$(git -C "$REPO" status --porcelain --untracked-files=all)"
PRIMARY_OID="$(git -C "$REPO" rev-parse HEAD)"
ORIGIN_MAIN_OID="$(git -C "$REPO" rev-parse origin/main)"
WT_BRANCH="$(git -C "$WT" branch --show-current)"
BRANCH_OID="$(git -C "$WT" rev-parse "refs/heads/$BR")"
HEAD_OID="$(git -C "$WT" rev-parse HEAD)"
WT_STATUS="$(git -C "$WT" status --porcelain --untracked-files=all)"
NESTED_WTS="$(git -C "$REPO" worktree list --porcelain | \
  awk -v prefix="$WT/" '/^worktree / { path=substr($0, 10); \
    if (index(path, prefix) == 1) print path }')"
IGNORED_ROOTS="$(git -C "$WT" status --short --ignored=matching \
  --untracked-files=normal)"
printf '%s\n' "$IGNORED_ROOTS"
PR_JSON="$(gh pr view "$BR" --repo corpora-inc/encorpora \
  --json state,mergedAt,baseRefName,headRefName,headRefOid)"
PR_STATE="$(jq -er .state <<<"$PR_JSON")"
PR_MERGED_AT="$(jq -er .mergedAt <<<"$PR_JSON")"
PR_BASE="$(jq -er .baseRefName <<<"$PR_JSON")"
PR_HEAD="$(jq -er .headRefName <<<"$PR_JSON")"
PR_HEAD_OID="$(jq -er .headRefOid <<<"$PR_JSON")"
REMOTE_OID="$(git -C "$REPO" ls-remote --heads origin "refs/heads/$BR" | \
  awk 'NR == 1 { print $1 }')"
test "$PRIMARY_BRANCH" = main
test -z "$PRIMARY_STATUS"
git -C "$REPO" merge-base --is-ancestor "$PRIMARY_OID" "$ORIGIN_MAIN_OID"
test "$WT_BRANCH" = "$BR"
test "$BRANCH_OID" = "$HEAD_OID"
test -z "$WT_STATUS"
test -z "$NESTED_WTS"
test "$PR_STATE" = MERGED
test -n "$PR_MERGED_AT"
test "$PR_BASE" = main
test "$PR_HEAD" = "$BR"
test "$PR_HEAD_OID" = "$HEAD_OID"
test -z "$REMOTE_OID" || test "$REMOTE_OID" = "$HEAD_OID"
if test -n "$IGNORED_ROOTS"; then
  printf 'Preserve local state, explicitly remove only verified regenerable !! roots, then rerun.\n' >&2
  exit 1
fi
git -C "$REPO" merge --ff-only --no-overwrite-ignore "$ORIGIN_MAIN_OID"
FINAL_PRIMARY_BRANCH="$(git -C "$REPO" branch --show-current)"
FINAL_PRIMARY_STATUS="$(git -C "$REPO" status --porcelain --untracked-files=all)"
FINAL_PRIMARY_OID="$(git -C "$REPO" rev-parse HEAD)"
FINAL_WT_BRANCH="$(git -C "$WT" branch --show-current)"
FINAL_BRANCH_OID="$(git -C "$WT" rev-parse "refs/heads/$BR")"
FINAL_HEAD_OID="$(git -C "$WT" rev-parse HEAD)"
FINAL_WT_STATUS="$(git -C "$WT" status --porcelain --untracked-files=all)"
FINAL_NESTED_WTS="$(git -C "$REPO" worktree list --porcelain | \
  awk -v prefix="$WT/" '/^worktree / { path=substr($0, 10); \
    if (index(path, prefix) == 1) print path }')"
test "$FINAL_WT_BRANCH" = "$BR"
test "$FINAL_PRIMARY_BRANCH" = main
test -z "$FINAL_PRIMARY_STATUS"
test "$FINAL_PRIMARY_OID" = "$ORIGIN_MAIN_OID"
test "$FINAL_BRANCH_OID" = "$HEAD_OID"
test "$FINAL_HEAD_OID" = "$HEAD_OID"
test -z "$FINAL_WT_STATUS"
test -z "$FINAL_NESTED_WTS"
FINAL_IGNORED_ROOTS="$(git -C "$WT" status --short --ignored=matching \
  --untracked-files=normal)"
test -z "$FINAL_IGNORED_ROOTS"
git -C "$REPO" worktree remove "$WT"
git -C "$REPO" update-ref -d "refs/heads/$BR" "$HEAD_OID"
if test -n "$REMOTE_OID"; then
  git -C "$REPO" push --force-with-lease="refs/heads/$BR:$HEAD_OID" \
    "$PUSH_URL" ":refs/heads/$BR"
fi
git -C "$REPO" worktree prune
git -C "$REPO" fetch --prune origin
```

Run that block as one shell invocation; do not split it across tool calls. The
tests fail closed unless the primary is a clean `main`, the worktree is a clean
checkout of exactly `$BR` with no nested registered worktrees, that exact head
was merged into `main` in the canonical GitHub repository, and the remote branch
is absent or still names that head. Explicit `--untracked-files=all` (or the
bounded ignored-root listing's explicit `normal`) overrides local status
configuration. The expected-OID local deletion and remote lease preserve a ref
if another agent advances it during cleanup.
The bounded ignored-root listing avoids walking millions of build artifacts,
but cleanup refuses to remove a worktree while any ignored state remains. Stop
all writers, recursively inspect every `!!` root, preserve non-regenerable local
config, credentials, databases, signing material, or nested work elsewhere,
then explicitly remove only verified regenerable output and rerun the block.
Ordinary `git status` hides ignored state. If any command or test fails, stop
and inspect the diff, log, and files; commit and push useful work on the existing
branch or a recovery branch. Never force-remove it.

The ancestry check rejects a primary `main` that is ahead or divergent;
`--ff-only --no-overwrite-ignore` then advances a behind primary to the exact
fetched `origin/main` OID without replacing ignored primary files. If either
refuses, investigate; do not force it.
Remote deletion uses the validated literal push URL and an explicit lease, so
extra configured push URLs cannot receive the deletion and a concurrent push
stops cleanup instead of deleting new work. Cleanup is part of Done; never leave
a merged worktree holding a Rust `target/`, `node_modules/`, app bundle, or
other regenerable build output. Only remove your own worktree.
