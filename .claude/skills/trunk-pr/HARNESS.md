# Making the loop resilient — what the harness can enforce

Companion to [`SKILL.md`](SKILL.md) and [`FAILURE-MODES.md`](FAILURE-MODES.md).
This file is about **mechanism**: which of those failure modes Claude Code can
catch for us, with syntax verified against the current docs rather than
remembered.

Everything below was checked against `code.claude.com/docs` on 2026-07-27.
Where a thing does **not** exist, it says so — a plausible-looking config that
silently does nothing is worse than no config.

---

## The invariant

> **Local `main` changes by fast-forward from `origin/main` and by nothing
> else.** The primary checkout stays clean. Every change reaches it as
> worktree → remote branch → PR → squash-merge → pull.

The rest of this file is about making that structurally true instead of
merely agreed.

---

## Why permission rules alone cannot express it

This was the obstacle, and it is worth stating precisely because it is what
`.claude/README.md` ran into when it considered and rejected hard denies:

- Bash rules are **glob patterns over the command string**. They support `*` at
  any position and nothing else. No shell logic, no conditionals.
  `Bash(git commit * && ! grep worktree)` is not a rule; it is a wish.
- Rules are evaluated **deny → ask → allow, first match wins, and specificity
  does not reorder them**. The docs are explicit: *"a deny rule can't carry
  allowlist exceptions."*
- A permission rule never sees **where** the command would run. "Deny `git
  commit` in the primary checkout but allow it in a worktree" is not expressible,
  because `cwd` is not part of the match.

So `deny` is the wrong tool: `Bash(git commit *)` would block every commit in
every worktree too, which is the whole job.

## Why a PreToolUse hook is the right tool

A hook **does** see `cwd`, and the docs give it precedence:

> "A blocking hook also takes precedence over allow rules. A hook that exits
> with code 2 stops the tool call before permission rules are evaluated […]
> To run all Bash commands without prompts except for a few you want blocked,
> add `"Bash"` to your allow list and register a PreToolUse hook that rejects
> those specific commands."

That is exactly our shape: allow the work, block the one location.

### Verified hook facts

| Fact | Detail |
| --- | --- |
| `matcher` matches the **tool name** | `"Bash"`, `"Edit\|Write"`, or a regex. **Not** the command string |
| `if` is a real **hook-entry** field | Uses permission-rule syntax to narrow on arguments, e.g. `"Bash(git commit *)"`. It sits on the hook, not on the matcher group |
| Blocking | `exit 2` with the reason on **stderr**; or `exit 0` printing `hookSpecificOutput` with `permissionDecision: "deny"` and `permissionDecisionReason` |
| stdin | JSON with `session_id`, `cwd`, `tool_name`, `tool_input`, `tool_use_id`, `permission_mode`, `transcript_path` |
| Subagent events | `SubagentStart` / `SubagentStop` are real, matched on **agent type**, and receive `agent_id` and `agent_type` |
| Hook decisions don't bypass rules | A matching `deny` still blocks even if a hook returned `allow` |

---

## Recommendation 1 — make the primary checkout structurally read-only

The single highest-value change, and the direct expression of the invariant.

`.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/primary-checkout-guard.sh\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/primary-checkout-guard.sh` — blocks **git writes whose working
directory is the primary checkout**, and nothing else:

```bash
#!/usr/bin/env bash
# Blocks git WRITES in the primary checkout. Worktrees are untouched.
# Exit 2 = block, with the reason on stderr. Exit 0 = allow.
set -u
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
cwd=$(printf '%s' "$input" | jq -r '.cwd // ""')

# Only git matters here.
case "$cmd" in *git*) ;; *) exit 0 ;; esac

# An explicit `git -C <path>` names its own target; judge that, not cwd.
target="$cwd"
if printf '%s' "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+-C[[:space:]]'; then
  t=$(printf '%s' "$cmd" | awk '{for(i=1;i<NF;i++) if($i=="-C"){print $(i+1); exit}}' | tr -d '"'"'"'')
  [ -n "$t" ] && target="$t"
fi
[ -d "$target" ] || exit 0

# Resolve EVERYTHING from inside the target. `rev-parse --git-common-dir` returns
# a path relative to the repo it was asked about, so resolving it against the
# hook's own cwd silently yields nothing and the guard fails OPEN. That bug was
# in the first version of this script and only a `git -C <primary>` test caught
# it — see FAILURE-MODES C3.
here=$(cd "$target" 2>/dev/null && pwd -P) || exit 0
common=$(cd "$target" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P) || exit 0
[ -n "$here" ] && [ -n "$common" ] || exit 0
primary=$(dirname "$common")
case "$here" in "$primary"|"$primary"/*) ;; *) exit 0 ;; esac   # in a worktree: allow

# In the primary checkout. Match the SUBCOMMAND, not a substring: `git -C <path>
# commit` contains no literal "git commit", so substring patterns miss exactly
# the cross-directory call that is most likely to be the mistake. Skip git's
# global options to find the verb.
verb=$(printf '%s' "$cmd" | awk '{
  i=1; while (i<=NF && $i!="git") i++; i++
  while (i<=NF) {
    if ($i=="-C" || $i=="-c") { i+=2; continue }
    if ($i ~ /^-/)            { i++;  continue }
    print $i; exit
  }
}')

case "$verb" in
  # The fast-forward ritual, and anything read-only.
  fetch|status|log|show|diff|rev-parse|ls-tree|ls-files|ls-remote|merge-base|\
  cat-file|for-each-ref|check-ignore|blame|worktree|remote|describe|shortlog|\
  rev-list|grep|config|help|version|"") exit 0 ;;
  # Allowed only in its fast-forward form.
  merge|pull)
    case "$cmd" in *--ff-only*) exit 0 ;; esac ;;
esac

echo "BLOCKED: 'git $verb' would write in the PRIMARY CHECKOUT ($primary)." >&2
echo "Local main changes ONLY by:  git -C '$primary' merge --ff-only origin/main" >&2
echo "Work belongs in a worktree:  git -C '$primary' worktree add -b <branch> \$WT_ROOT/<branch> origin/main" >&2
exit 2
```

**Verified, because a guard that fails open is worse than no guard.** The 16
cases below all pass. Feed the hook a JSON line on stdin and check its exit code
(`2` = blocked, `0` = allowed):

| Command | cwd | Exit |
| --- | --- | --- |
| `git commit -m x` | primary | **2** |
| `git commit -m x` | worktree | 0 |
| `git merge --ff-only origin/main` | primary | 0 |
| `git merge origin/feature` | primary | **2** |
| `git -C <primary> commit -m x` | worktree | **2** |
| `git -C <worktree> commit -m x` | primary | 0 |
| `git -C <primary> push origin main` | `/tmp` | **2** |
| `npm test` | primary | 0 |
| `git worktree add …` | primary | 0 |
| `git status` / `git fetch origin` | primary | 0 |
| `git checkout -b foo` | primary | **2** |
| `git clean -fdx` | primary | **2** |
| `git reset --soft origin/main` | primary | **2** |
| `git rebase origin/main` | worktree | 0 |
| `git stash` | primary | **2** |

Writing those tests found **two real bugs in this very script**, both of which
failed *open* — silently allowing what they were written to block:

1. `git -C <path> rev-parse --git-common-dir` returns a path **relative to the
   target repo**. Resolving it against the hook's own cwd produced nothing, and
   the guard exited 0. It only looked correct because the first tests happened
   to run from the primary checkout.
2. Matching `*"git commit"*` as a substring misses `git -C /path commit` — there
   is no literal `git commit` in it. That is *exactly* the cross-directory call
   most likely to be the mistake. Fixed by parsing the **subcommand**, skipping
   git's global options.

Both are instances of FAILURE-MODES C3 (a check that passes for the wrong
reason), found the only way such things are found: by asserting the guard fails
when it should.

**Tradeoffs, stated honestly.**

- This **is** a blocking hook, and `.claude/README.md` currently says nothing in
  `.claude/` blocks. That policy was written against a *blanket* `deny` on
  `gh pr merge`, which would have blocked the CTO's own merges. This is
  different: it blocks one **location**, never a workflow, and the escape hatch
  is a one-word change of directory. If we adopt it, `README.md`'s "Nothing here
  blocks anything" must be amended in the same PR — a doc that lies about the
  control plane is exactly failure mode E.
- Runs on **every** Bash call. It is `jq` plus a couple of `git rev-parse`s;
  keep it that cheap and keep the 10s timeout.
- It cannot see through `bash -c '…'` wrappers or shell aliases. It raises the
  cost of the mistake; it does not make it impossible.

---

## Recommendation 2 — never let a dead agent take work with it

Our worst failure of the day: an agent hit the watchdog having committed but not
pushed, and in one case having amended *after* the orchestrator took the branch.
The most consequential bug fix of the session was left behind in a worktree,
looking finished.

**`SubagentStop` fires when a subagent finishes** and receives `agent_id` and
`agent_type`. Use it to make abandoned work loud:

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/subagent-work-audit.sh\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

```bash
#!/usr/bin/env bash
# Reports any worktree holding work that is not on the remote.
set -u
input=$(cat); cwd=$(printf '%s' "$input" | jq -r '.cwd // ""')
common=$(git -C "$cwd" rev-parse --git-common-dir 2>/dev/null) || exit 0
findings=""
while read -r d; do
  [ -d "$d" ] || continue
  dirty=$(git -C "$d" status --porcelain --ignored=matching \
    --untracked-files=normal 2>/dev/null | wc -l | tr -d ' ')
  unpushed=$(git -C "$d" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
  [ "$dirty" = "0" ] && [ "${unpushed:-0}" = "0" ] && continue
  findings="${findings}  ${d}: ${dirty} local paths/ignored roots, ${unpushed} unpushed\n"
done < <(git -C "$cwd" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2}')
[ -n "$findings" ] && printf 'WORK NOT ON THE REMOTE:\n%b' "$findings" >&2
exit 0
```

Exit 0 so it only reports. It turns "the agent said it was done" into a
checkable claim.

**This is not hypothetical. Run against this repo today, it found:**

```
worktrees holding unpushed work: 51
total uncommitted files across them: 864
total unpushed commits: 45
```

One worktree alone holds **501 uncommitted files**. None of that is in a PR;
none of it is on a remote; none of it is visible to `git log --all`. That
backlog accumulated silently, one finished-looking agent at a time, which is
precisely the argument for the hook: it costs nothing and it makes the invisible
loud. (Triage is a separate job — most of it is probably stale, but "probably"
is doing a lot of work in that sentence, and nobody can currently tell.)

**Discipline that matters more than the hook**, and belongs in every brief:

> Push after every commit. A commit that only exists in a worktree is not
> delivered. If you amend, push again — even if you already pushed, and
> especially if someone else may have taken the branch.

---

## Recommendation 3 — stop agents colliding in the scratchpad

**There is no per-subagent scratch isolation.** Subagents in a session share the
scratchpad path, which is how one `--amend` picked up another PR's subject line.
`isolation: worktree` isolates the *checkout*, not `/tmp`.

Convention, since there is no mechanism: **namespace every temp file by branch
or `agent_id`**, and verify after any commit or amend:

```bash
git -C "$WT" log -1 --format='%s'
git -C "$WT" show --stat --oneline HEAD | head -20
```

`SubagentStart` receives `agent_id`, so a hook could pre-create
`$SCRATCH/$agent_id` — but the convention is what actually prevents the bug, and
it costs nothing.

---

## Recommendation 4 — the settings we should set

```json
{
  "worktree": { "baseRef": "fresh" }
}
```

`"fresh"` (the default) branches every worktree from `origin/HEAD`, which is our
rule already. Worth writing down so nobody sets `"head"` and starts branching
subagent worktrees off in-progress local state.

Also real and useful:

- **`.worktreeinclude`** — `.gitignore`-syntax list of gitignored files copied
  into each new worktree (`.env` and friends). Only matters once a game needs
  local config.
- **`isolation: worktree`** in a subagent's frontmatter makes isolation
  permanent for that agent type. Our workers already get explicit worktrees; this
  is the declarative version.
- **`cleanupPeriodDays`** governs the sweep — which, verified, **skips worktrees
  holding work** and never touches `--worktree` ones. Claude's cleanup is not the
  thing that loses work.

---

## What does not exist — do not build on it

| Belief | Reality |
| --- | --- |
| Subagents get a watchdog that resumes them | **No.** Background *sessions* have supervision; in-session subagents do not. A stalled subagent stays stalled — the orchestrator must notice and take over |
| `SendMessage` recovers a crashed agent | It resumes an agent from its transcript; it is not crash recovery, and it will not retrieve work the agent never pushed |
| Subagents get isolated temp dirs | **No.** Namespace them yourself |
| A `deny` rule can say "except in a worktree" | **No.** Deny rules cannot carry exceptions and cannot see `cwd` |
| Auto-checkpointing of agent work | **No** hook fires on a timer. `PostToolUse` on `Bash(git commit *)` could auto-push, but an auto-push that fires mid-rebase is its own hazard — prefer the discipline and the audit hook |

---

## Adoption order

1. **Recommendation 2** (`SubagentStop` audit) — pure gain, blocks nothing,
   directly addresses the failure that cost the most today.
2. **The briefing discipline** — push after every commit; namespace scratch
   files; verify the commit after amending. Free.
3. **Recommendation 1** (primary-checkout guard) — the real enforcement of the
   invariant, but it changes `.claude/`'s advisory-only posture and needs
   `README.md` amended in the same PR. Founder's call.
4. **Recommendation 4** — write `worktree.baseRef: "fresh"` down.
