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

## 0. Ground rules

- The primary checkout at `/Users/skyl/Code/corpora/encorpora` is **read-only**.
  Read from it, run read-only git in it, never edit or check out in it.
- Every worktree goes **outside** the repo directory:
  `/Users/skyl/Code/corpora/wt/<branch>`. Worktrees nested inside the repo bloat
  every search and get left behind (27 are nested there today).
- Path-gate anything you add to CI. That is what makes constant merging safe in
  a monorepo.

## 1. `git -C` discipline — read this before your first git command

**The shell's working directory resets between tool calls.** A command shaped
like

```bash
cd /Users/skyl/Code/corpora/encorpora && git checkout -b feature   # WRONG
```

operates on the **primary checkout**, not on your worktree, even if a previous
call left you in the worktree. This has caused a real incident: work committed
onto the primary checkout, off any branch anyone was tracking.

Use an explicit `-C` on every single git invocation:

```bash
WT=/Users/skyl/Code/corpora/wt/<branch>
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
REPO=/Users/skyl/Code/corpora/encorpora
BR=<verb>-<short-slug>            # e.g. fix-catalog-dedupe, add-stargate-zh
WT=/Users/skyl/Code/corpora/wt/$BR

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

## 6. Diff size — split before you push

The adversarial-review gate truncates the diff at `MAX_DIFF_BYTES`, default
**200 000** (`.github/scripts/adversarial_review.py:115`). Past that byte
offset, **no lens sees the code**, and the check can go green having reviewed
half your PR. Re-running does not help; it re-reviews the same prefix.

```bash
git -C "$WT" diff --unified=3 origin/main...HEAD | wc -c
```

Over ~200 000 → split into stacked PRs. Land generated or vendored bulk
(lockfiles, fixtures, bundled dist) in its own mechanical PR first so the
reviewable change fits.

`hygiene` also fails any added non-LFS file over 5 MiB.

## 7. Commit and push

Conventional commit, imperative, honest. No emoji.

```bash
git -C "$WT" add -A
git -C "$WT" status --porcelain     # confirm exactly what you intend
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

## 11. Fast-forward local main, then clean up

```bash
git -C "$REPO" fetch origin
git -C "$REPO" merge --ff-only origin/main
git -C "$REPO" worktree remove "$WT"
git -C "$REPO" worktree prune
```

`--ff-only` is deliberate: if it refuses, the primary checkout has commits of
its own, which means rule 0 was broken. Investigate; do not force it.
