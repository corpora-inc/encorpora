# `.claude/` — the shared agent control plane

Tracked in git, reviewed like code, applies to every Claude Code session opened
on this repo:

| Path | What it is |
| --- | --- |
| `agents/` | Subagent definitions (`adversarial-reviewer`, `native-gatekeeper`, `curriculum-author`, `store-operator`) |
| `skills/` | Procedures loaded on demand — `trunk-pr` is the worker loop, `native-move` is the plugin-relocation checklist |
| `commands/` | Slash commands (`/ship`, `/native-check`) |
| `hooks/` | `worktree-guard.sh`, run at SessionStart |
| `settings.json` | Permission allowlist + hook registration |
| `README.md` | this file |

Everything else under `.claude/` is per-machine scratch and is gitignored:
`settings.local.json` (your own permission overrides), `worktrees/`, session
state, locks. Only the paths above are un-ignored, one negation each — if you
add a new tracked file here you must add its negation to `.gitignore` or git
will not see it. Nested `.claude/` directories elsewhere in the tree (e.g.
`corpan/.claude/`) are ignored at every depth and are never source of record.

## Nothing here blocks anything

This control plane is **advisory by construction**.

- `settings.json` has an `allow` list and no `deny` list. An allowlist only
  suppresses permission prompts for read-only and check commands; omitting a
  command means it *prompts*, not that it is refused.
- `hooks/worktree-guard.sh` is a SessionStart hook that prints and always
  `exit 0`s. It cannot halt a session, and a SessionStart hook cannot veto a
  later tool call anyway.

So the two rules that matter most — **do not write in the primary checkout** and
**do not merge unless told to** — are convention plus review, not machinery. A
hard `deny` on `gh pr merge` was considered and rejected: `AGENTS.md`'s steady
state is auto-merge by the person driving, deny beats allow at every precedence
level, and a project-level deny would block the CTO's own sessions. The real
enforcement is branch protection (`ci-gate`, `adversarial-review`, `hygiene`,
strict up-to-date, linear history) and the review on the PR.
