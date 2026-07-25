---
description: Claim an issue, work it in an out-of-repo worktree, and open the PR
---

Ship one change end to end following the `trunk-pr` skill. Load it before you
start; it is the procedure, this is the trigger.

Target: $ARGUMENTS (an issue number, or a description of the change)

1. Claim exactly one issue and move it to Doing. WIP = 1.
2. `git -C /Users/skyl/Code/corpora/encorpora fetch origin`, then
   `worktree add -b <verb>-<slug> /Users/skyl/Code/corpora/wt/<verb>-<slug> origin/main`.
   Every later git call uses `git -C <worktree>` — the shell cwd resets between
   tool calls and a bare `cd repo && git` writes to the read-only primary
   checkout.
3. Implement. Stay in scope; note anything out of scope instead of touching it.
4. Verify. Run the real gates for what you touched and keep the output — the PR
   body needs it verbatim.
5. `git -C <worktree> diff --unified=3 origin/main...HEAD | wc -c`. Over 200000
   → split the PR; the review gate truncates there and never sees the rest.
6. Commit (conventional, no emoji), push, `gh pr create` filling
   What / Why / Blast radius / Proof.
7. Run the `adversarial-reviewer` agent over the branch and fix what it finds.
8. Report the PR URL. **Do not merge** unless you were told to.
