#!/usr/bin/env bash
# SessionStart advisory for the encorpora monorepo. WARNS, NEVER BLOCKS.
#
# Trunk-based development is the law here: worktree -> PR -> adversarial review
# -> squash-merge. Agents merge to main constantly, so a hook that can halt a
# session would halt every agent in the repo at once. Every path below ends at
# `exit 0`, and nothing here reads the network or walks a large tree.
#
# Cost budget: a few `git rev-parse` calls, one `git worktree list`, one `df`.
# Deliberately NO `du` — `corpan/corpan-app/src-tauri/target/` alone is ~148G
# and would take minutes to stat.

set -u

command -v git >/dev/null 2>&1 || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

common="$(git rev-parse --git-common-dir 2>/dev/null)" || exit 0
[ -n "${common}" ] || exit 0
common="$(cd "${common}" 2>/dev/null && pwd -P)" || exit 0

primary="$(dirname "${common}")"          # the primary (non-worktree) checkout
here="$(pwd -P)"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
wt_root="$(dirname "${primary}")/wt"      # sibling of the repo, NOT inside it

printf 'worktree-guard\n'

# 1. The primary checkout on main is read-only by convention: it is the
#    reference tree everyone reads from and the one that gets fast-forwarded
#    after a merge. Editing it strands work outside any PR.
if [ "${here}" = "${primary}" ] && [ "${branch}" = "main" ]; then
  printf '  ! primary checkout on main (%s) — treat as READ-ONLY.\n' "${primary}"
  printf '    Work belongs in a worktree:\n'
  printf '      git -C %s fetch origin\n' "${primary}"
  printf '      git -C %s worktree add -b <branch> %s/<branch> origin/main\n' "${primary}" "${wt_root}"
  printf '    Then drive it as `git -C %s/<branch> ...` — a bare `cd <repo> && git`\n' "${wt_root}"
  printf '    in a later tool call lands back here, because cwd resets between calls.\n'
else
  printf '  cwd %s  (branch %s)\n' "${here}" "${branch}"
fi

# 2. Worktree sprawl. Measured 2026-07-25: 35 registered, 27 of them nested
#    INSIDE the primary working directory (26 under .claude/worktrees/, 1 under
#    corpan/.claude/worktrees/). Nested worktrees bloat the tree every tool
#    call has to search and are trivially left behind; put new ones in wt_root.
wt_count="$(git worktree list 2>/dev/null | wc -l | tr -d ' ')"
nested="$(git worktree list 2>/dev/null | awk '{print $1}' | grep -c "^${primary}/")"
if [ "${wt_count:-0}" -gt 12 ]; then
  printf '  ! %s registered worktrees (%s nested inside the repo).\n' "${wt_count}" "${nested}"
  printf '    Prune yours when the PR merges: git worktree remove <path> && git worktree prune\n'
fi
printf '  new worktrees go OUTSIDE the repo: %s/<branch>\n' "${wt_root}"

# 3. Disk. Measured 2026-07-25 on the founder machine:
#      corpan/                                179G
#      corpan/corpan-app/src-tauri/target/    148G  (the big one)
#      target/            (shared repo root)   52G
#      .claude/worktrees/                      36G
#    A fresh worktree is another ~9.7k files, and each `cargo build` in it
#    grows its own target/. Volume was 98% full (23Gi free) at that measurement.
avail="$(df -h . 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "${avail:-}" ]; then
  printf '  disk %s free here. Rust targets are the whole story: src-tauri/target ~148G,\n' "${avail}"
  printf '    repo-root target/ ~52G, .claude/worktrees ~36G. Do not `cargo clean` blindly\n'
  printf '    (rebuilds cost ~an hour); do remove merged worktrees.\n'
fi

exit 0
