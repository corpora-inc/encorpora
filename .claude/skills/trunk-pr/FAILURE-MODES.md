# Failure modes of the worktree → PR → trunk loop

Companion to [`SKILL.md`](SKILL.md). Every entry here **actually happened in
this repo**, most of them in a single day. They share one property, which is why
they are worth a document:

> **They all look like success.** No crash, no red check, no conflict. The work
> looks done, the gate looks green, `main` looks fine.

Each entry gives the symptom, why it is invisible, and a **guard** — a command
you can run, or a rule you can follow, that turns it back into a visible
failure.

The invariant the whole loop exists to protect:

> **Local `main` changes by fast-forward from `origin/main` and by nothing else.**
> The primary checkout sits on a clean `main` at all times. Every change reaches
> it as worktree → remote branch → PR → squash-merge → pull.

---

## A. Work that never reaches git

### A1. Untracked work is invisible to every ref-based search

**What happened.** Eleven finished games — ~60k lines — existed only as
untracked files inside worktrees. `git log --all -- dynawalla/games/<name>`
returned **zero commits** for every one. They were never committed, never
branched, never stashed.

**How much danger, exactly** — verified rather than assumed, because the honest
version is narrower than the scary one:

| Action | Result |
| --- | --- |
| `git worktree remove <path>` | **Refuses.** `fatal: '<path>' contains modified or untracked files, use --force to delete it` |
| `git worktree remove <path>` with only ignored files | **Destroys the ignored files.** Ordinary status does not show them |
| `git worktree remove --force <path>` | **Destroys it.** No reflog, no dangling object |
| Claude Code's periodic worktree sweep | **Skips it.** The sweep "skips a worktree that still holds work: changed or untracked files, or unpushed commits", and never touches worktrees you made with `--worktree` |

Git and the sweep defend visible untracked work, but ignored files remain at
risk and `--force` bypasses the visible-file guard. This work has no backup
anywhere — not in a ref, stash, or the object store. Any `git clean -fdx`, disk
loss, ordinary removal of ignored-only state, or impatient `--force` ends it.

**Why invisible.** `git log --all`, `git branch -a`, `git stash list` and
`git fsck --lost-found` all search *objects*. Untracked files are not objects.
Every one of those commands answers "nothing here" and is correct.

**Guard.** When taking inventory, sweep the filesystem, not the object store:

```bash
git worktree list --porcelain | grep '^worktree' | cut -d' ' -f2 | while read -r d; do
  n=$(git -C "$d" status --porcelain --ignored=matching --untracked-files=normal | wc -l)
  [ "$n" -gt 0 ] && printf '%-60s %s dirty/untracked\n' "$d" "$n"
done
```

**Never** `git worktree remove` a worktree whose
`git status --porcelain --ignored=matching --untracked-files=normal` is non-empty
without recursively reading the reported roots first and distinguishing
regenerable build output from local state. `matching` avoids enumerating every
file in enormous ignored `target/` and `node_modules/` trees; explicit `normal`
keeps the result independent of `status.showUntrackedFiles`.

### A2. A stalled agent leaves finished work uncommitted, or committed and unpushed

**What happened.** Three of six background subagents hit the no-progress
watchdog. Two had committed but not pushed. One had *amended* its commit after
the orchestrator had already taken the branch, so its final work — which
included the most consequential bug fix of the session — sat diverged and
invisible while its PR merged without it.

**Why invisible.** The agent's last words were "All green. Amending the commit."
That reads as success. The PR was green and merged. Nothing anywhere said a
newer commit existed.

**Guard.** When an agent dies, **inspect its worktree before believing its PR**:

```bash
git -C "$WT" status --porcelain --untracked-files=all # uncommitted?
git -C "$WT" rev-list --count @{u}..HEAD               # committed, unpushed?
git -C "$WT" rev-list --count HEAD..@{u}               # diverged from what you pushed?
git -C "$WT" diff origin/main HEAD -- <its paths>      # what does it have that main lacks?
```

If local and upstream have diverged, diff the **trees**, not the commits — the
commit ids differ after any rebase or amend, which proves nothing either way.

### A3. Uncommitted work looks identical whether it is newer or stale

**What happened.** Arena and runner each carried ~1,000 and ~400 lines of
uncommitted changes on a branch whose upstream had moved. Impossible to tell by
inspection whether it was newer work worth keeping or a superseded leftover.

**Guard.** Two cheap questions settle it:

```bash
git -C "$WT" log -1 --format=%ci HEAD; git -C "$WT" log -1 --format=%ci @{u}
git -C "$WT" diff --name-only -- <paths> | while read -r f; do
  stat -f '%Sm %N' -t '%Y-%m-%d %H:%M' "$WT/$f"; done | sort -r | head
```

File mtimes later than both commit dates ⇒ the working tree is the newest state.
Then confirm nothing upstream is lost:

```bash
git -C "$WT" diff HEAD @{u} -- <paths>   # empty ⇒ same tree ⇒ WIP is a strict superset
```

---

## B. Git operations that silently do the wrong thing

### B1. `git reset --soft origin/main` reverts everything that landed in between

**What happened.** `origin/main` advanced mid-session. A `reset --soft
origin/main` re-parented the commit onto the **new** tip while keeping the
**old** tree. The result reverted a whole merged PR across 35 files. No
conflict. No warning. It force-pushed cleanly.

**Guard.** Re-base with `git rebase origin/main`. **Never `reset --soft`.**
Then always:

```bash
git -C "$WT" diff --name-only origin/main...HEAD | grep -v '^<your path>/'   # must be empty
git -C "$WT" diff --diff-filter=D --name-only origin/main...HEAD             # must be empty
```

A deletion you did not intend is the signature of this bug.

### B2. `cd <repo> && git …` operates on the primary checkout

**Why.** The shell's working directory **resets between tool calls**. A `cd` in
an earlier call does not persist, so a later bare `git` runs wherever the tool
starts — the primary checkout. This has put commits on the primary checkout, off
any branch anyone was tracking.

**Guard.** `git -C "$WT" …` on **every single** invocation. No exceptions.
Same for `gh`: pass `--repo`.

### B3. Renaming a branch does not move its worktree directory

`git branch -m old new` leaves the directory at `$WT_ROOT/old`. Subsequent
`git -C "$WT_ROOT/new"` fails with "No such file or directory" — or worse,
silently targets a path you did not mean. Track the **path** and the **branch**
as separate variables.

### B4. Unrelated deletions in a worktree abort a rebase

Worktrees accumulate stray deletions of tracked build output
(`corpan/packs/*/dist/*`). `git rebase` then aborts with "cannot rebase: You have
unstaged changes" — nothing to do with your work.

**Guard.** `git -C "$WT" checkout -- .` first. Stage only your own path:
`git -C "$WT" add <your dir>`. **Never `git add -A`** — it sweeps those
deletions into your commit.

### B5. Discovery by position breaks when the base moves

`g=$(ls dir | head -1)` picked `forge` instead of the target game, because
rebasing onto a newer `main` had restored other games into the directory. Five
commits silently became no-ops.

**Guard.** Name things explicitly. After any `git add`, assert something was
staged:

```bash
n=$(git -C "$WT" diff --cached --numstat -- "$path" | wc -l)
[ "$n" -eq 0 ] && { echo "NOTHING STAGED — abort"; exit 1; }
```

### B6. `gitleaks` scans every commit in the range

A fix in a *later* commit does not clear a secret introduced in an earlier one —
the range still contains it. Also: the `generic-api-key` rule fires on
`const SOMETHING_KEY = "dotted.string.v1"`, i.e. ordinary `localStorage` names,
because it matches on entropy and length, not meaning.

**Guard.** Amend or squash so the string never appears in the range. For the
false positive, rename to `*_SLOT` and add `// gitleaks:allow` with a comment
saying why — the pattern is in `dynawalla/games/forge/src/game/save.ts`.

### B7. zsh does not word-split unquoted variables

`set -- $pair` inside a loop silently produced one argument instead of two, and
every `git -C` in that loop targeted a nonexistent path. The tool's shell is
zsh; do not carry bash word-splitting habits into it.

---

## C. Gates that pass while being wrong

This is the most dangerous class: **a green check over unreviewed or untested
code.**

### C1. One green test run is not proof

`serpent` passed once, then failed **3 of the next 5 runs**, in three different
tests. Its world uses raw `Math.random` for ambience by design, and the test bot
drew from the same stream.

**Guard.** Run a new or newly-touched suite **5 times** before calling it green.
If it flakes, seed the randomness **inside the test file** — do not change the
game's randomness to suit a test.

### C2. A test can encode the bug as the intended behaviour

PULSE had a passing test asserting `candidates.length === 1` for the exact shape
where the child is handed a single unmissable target. It described what the code
did, not what a child should get.

**Guard.** When a test blocks a fix, read its **title** for the intent, not its
assertion for the contract. Preserve the intent, correct the assertion, and say
so in the commit.

### C3. A test can pass vacuously

Three instances in one day:

- `polarity` swept 4,000 questions but never escalated difficulty, so 3 of 6
  generator families were **never generated** and their assertions never ran.
- A `horde` regex used a lookbehind that exempted `(-4)` — precisely the shape
  the generator emits — so the one regression it existed to catch was the one it
  could not see.
- A sweep over the *wrong host*: PULSE's own stub serves fractions, so sweeping
  it could not produce the degenerate case the test was written for.

**Guard.** Make the test **prove it visited the case**:

```ts
assert.ok(degenerateShapes > 0, "swept nothing that could degenerate");
```

And prove the test earns its keep by **breaking the fix and watching it fail**.
A regression test never observed failing is a decoration.

### C4. A gate can validate the schema and not the meaning

`dw-pack check` validates a pack manifest and **does not** check that
`covers.skills` names real curriculum skills. A fictional id passes silently.
Related: a pack that omits the `items.reveal` capability serves **zero
questions** — it mounts, warms, and is simply empty. No crash, no failing gate.

**Guard.** Know what each gate actually asserts. When a gate cannot check
something, check it by hand and **write in the PR that you did**.

### C5. A NUL byte makes a file binary, and binary is excluded from review

`glyphs.test.ts` contained a literal NUL. Git classified it as binary, so its
content was excluded from every diff **and from the adversarial-review gate**.

**Guard.** `git diff --numstat` shows `-` `-` for binary files. A source file
with `-` in those columns is a bug.

### C6. `cancelled` counts as failure, and looks like a real one

`ci-gate` fails on `cancelled` as well as `failure`. A superseded run — from
your own force-push — leaves a red `ci-gate` whose cause is a `dynawalla-app`
job marked `cancelled`, not anything about your code.

**Guard.** Read *which* job failed before debugging. `gh run rerun <id>` for a
cancellation.

---

## D. Orchestration

### D1. Parallel agents collide in a shared scratchpad

Agents wrote commit-message files to the same session scratchpad path. One
`git commit --amend` picked up **a different PR's subject line**.

**Guard.** Namespace every temp file with your branch:
`/tmp/.../<branch>-commit-msg.txt`. After any commit or amend, verify what
landed before pushing:

```bash
git -C "$WT" log -1 --format='%s'
git -C "$WT" show --stat --oneline HEAD | head -20
```

### D2. Propagating an unvalidated recipe multiplies the mistake

A packaging recipe was nearly handed to five agents at once. Validating it end
to end on **one** unit first caught two traps that would otherwise have shipped
five times over — including a capability that makes the artifact silently empty.

**Guard.** Prove the procedure on one unit yourself. Hand out the **verified**
recipe, including the traps you hit.

### D3. A correction must reach agents already in flight

When you discover the recipe was wrong, agents mid-task are still applying the
old one. Message every one of them immediately, with the evidence, and say
explicitly whether to amend or open a follow-up.

### D4. Delegation does not transfer responsibility

Every returned result here was verified independently — skill ids resolved
against the graph, scope re-checked, tests re-run. Agents got things right that
the orchestrator got wrong, **and** left work behind that looked finished. Trust
the reasoning; verify the artifact.

---

## E. Stale guidance is a failure mode

A rule survived in **seven files** after the thing it described was fixed:
`adversarial-review` truncated diffs at 200,000 bytes and still reported green
(PR #521: 850,261 bytes, 186 files, 67 reviewed, conclusion `success`). Real bug.
The planned fix was "fail above the cap, make authors split". What actually
shipped was **chunking with asserted full coverage** — so the hole closed and no
one needs to split anything. The docs never caught up, and cost real work in
PRs split for nothing.

**Guard.** When a doc states a mechanism, check the mechanism — not the doc's
age. Every doc here is a claim about code, and code is checkable. When you find
a stale claim, delete it **and say what replaced it**, so the next reader knows
it was reconsidered rather than forgotten.

---

## Preflight

Before `git push`, from the worktree:

```bash
git -C "$WT" diff --name-only origin/main...HEAD | grep -v '^<your path>/'   # empty
git -C "$WT" diff --diff-filter=D --name-only origin/main...HEAD            # empty
git -C "$WT" log --oneline origin/main..HEAD                                # only yours
cd "$WT" && gitleaks detect --no-banner --redact --log-opts="origin/main..HEAD"
# gates for what you touched, tests ×5 if they are new or newly touched
```

## Postflight

After the merge, follow the deletion preflight and explicit-path cleanup in
[`SKILL.md` §11](SKILL.md#11-prove-the-work-is-safe-then-clean-up-immediately).
It checks tracked, untracked, ignored, unpushed, divergent, and post-merge work
before removing the worktree.

`--ff-only` is the invariant, expressed as a command. If it refuses, something
wrote to the primary checkout, and that is the incident — not the refusal.
