# 33. Working with Agents

## What it is

The team works with AI coding agents (Claude Code, Cursor,
similar) as a daily practice. Several pieces of the codebase
visibly carry the fingerprints of this collaboration: the
`CLAUDE.md` and `AGENTS.md` files at various subtree roots
documenting agent-facing conventions, the pr-agent GitHub
Action (section 03) that posts LLM-generated summaries on every
PR, the `~/projects/ttsctl/changelog/decisions/` per-discovery
files that track agent-and-human investigation outcomes, and
the auto-memory system at
`~/.claude/projects/-Users-jeffryeverett-Code-encorpora/memory/`
that persists context across sessions.

This section is the practitioner's view of how the agents are
used productively in this codebase. Section 34 covers the
complement: what humans still hold in their heads.

## How it fits

The agent era is the current moment in software engineering;
this project is one of the codebases living through it. The
practical implications fall into a small set of patterns:

- **Worktrees as the parallelism primitive.** Three concurrent
  worktrees today (section 03), each on its own branch with its
  own agent. The mechanic exists because git supports it;
  using it routinely is the agent-era choice.
- **CLAUDE.md / AGENTS.md as agent-facing docs.** A handful of
  subtree roots have a markdown file specifically addressed to
  the agent that will land in that directory next. The corpus
  app's `corpan/CLAUDE.md` and the third-grade-homeschool's
  `AGENTS.md` are examples.
- **Auto-memory as state across conversations.** The
  per-project memory file under `~/.claude/projects/.../`
  records facts and feedback the agent should carry into the
  next conversation. The user maintains it; the agent reads it
  on session start.
- **Decision logs.** The Spark's
  `~/projects/ttsctl/changelog/decisions/` directory and the
  encorpora repo's `PIPELINE_STATE.md` together capture the
  per-discovery investigation outcomes the agent and the
  human made together.

## Files and entry points

- `corpan/CLAUDE.md`: the deepest agent-facing doc in the repo.
  Documents the corpan app's architecture for an agent
  landing there fresh.
- `corpan/CHANGELOGS.md`: the shippable-units doctrine.
  Agents that touch shippable units are expected to update
  changelogs in the same PR.
- `corpan/corpan-app/AGENTS.md`: agent-facing notes specific to
  the app subtree.
- `corpan/dja/AGENTS.md` (if present): Django-specific.
- `third-grade-homeschool/AGENTS.md` and similar: per-book
  agent-facing notes (style, formatting, math conventions).
- `web/io/AGENTS.md`: marketing-site-specific.
- `.github/workflows/pr-agent.yml`: the Codium PR-Agent action
  (section 03).
- `~/.claude/projects/-Users-jeffryeverett-Code-encorpora/memory/`
  (outside the repo): the auto-memory. `MEMORY.md` indexes the
  individual files.
- `PIPELINE_STATE.md` at the repo root: the dated snapshot
  Skylar maintains for the narration pipeline.

## How it works

### Briefing the agent

The single highest-leverage practice in this codebase is to
brief the agent like a smart colleague who just walked into the
room. The pattern, from the project's own conventions:

- Name the goal in one sentence.
- Name the constraints in one or two more.
- Name what has been tried.
- Name what is out of scope.
- Point at the specific files or sections the agent should
  read first.

The pattern is so consistent that the CLAUDE.md files codify it:
each subtree's CLAUDE.md is essentially a pre-written brief for
"the agent that lands in this directory next." Reading the
CLAUDE.md before reading any code is the agent's first move; if
the CLAUDE.md is absent or out of date, the human notices and
fixes it on the next pass.

### Plan vs action

Two modes the agent runs in:

- **Plan mode**: the agent reads, thinks, and proposes. No
  files change; the agent returns a structured plan the human
  can edit or approve.
- **Action mode**: the agent reads, thinks, and writes. Files
  change; the human reviews the resulting diff.

The discipline: ask for plan mode when the task is ambiguous
or far-reaching (a refactor, a new feature, a multi-step
investigation). Ask for action mode when the task is concrete
and the agent has the context it needs (a typo fix, a small
documented change, a recipe-style task).

The Codex itself is a plan-mode artifact in part: the briefing
the user gave the agent was a multi-page plan, and the agent's
first move was to produce the skeleton commit before writing
any prose. The skeleton was the plan made concrete.

### Worktrees as the parallel primitive

Three concurrent worktrees on the same disk means three agents
(or three Jeff / Skylar conversations) can each touch different
files at the same time. Section 03 walks the mechanic; the
practice is:

- One worktree per active piece of work. Not per branch in
  general, but per branch the human (or agent) is actively
  editing.
- The naming convention is `<project>-<branch-suffix>` (the
  current three are `encorpora`, `encorpora-ear`,
  `corpora-codex`).
- An agent in one worktree should **stay in its lane**. The
  shared object database does not prevent an agent in
  `corpora-codex` from editing files in `corpan/`; the
  discipline does.

The "stay in your lane" rule is the user's reminder during the
Codex session; it is the working norm.

### The auto-memory contract

The Claude Code agent reads
`~/.claude/projects/.../memory/MEMORY.md` on every session and
treats the indexed files as remembered context. The user
maintains the memory deliberately:

- Adds entries when a non-obvious fact is established (the
  Opus-in-OGG iOS gotcha, the no-dashes-in-tts-text rule, the
  voice-clone-locations note).
- Updates entries when state changes (Melopán's shipped
  version, Quest-Ear's current branch).
- Removes entries when something is no longer true.

The agent's job, on the consumer side: treat memory as
context for what was true at a point in time, verify before
acting on memory-derived recommendations, and surface
discrepancies the next time they appear.

The memory is not infrastructure the codebase ships; it is
infrastructure the user maintains for themselves. The Codex
sits beside it in the same spirit: documentation the user
maintains for future selves and future agents.

### The pr-agent loop

Every PR opened against `corpora-inc/encorpora` triggers the
`pr-agent.yml` workflow (section 03), which runs Codium's
PR-Agent against the diff. PR-Agent posts:

- A summary comment describing the change.
- A code review with line-level suggestions.
- Test-coverage observations (where applicable).

The agent's output is not a gate; humans (Skylar, primarily,
for this team) still review. The agent's contribution is the
first pass: a summary that surfaces what the PR actually
changes, suggestions that catch the obvious patterns. The
human's contribution is the judgment of whether the change is
right for the project right now.

### Discipline of reading the diff

The single largest reason to know how Git works (section 03) in
the agent era is to be able to read what the agent did. Every
agent action becomes a diff; the diff is the artifact the human
trusts or distrusts. The practices that pay off:

- `git status` before approving an agent's claim that it is
  done. The agent's understanding of "done" sometimes differs
  from the working tree.
- `git diff --stat` to see the shape of the change at a glance.
- `git diff <path>` to read the actual edits.
- `git log --oneline` after a session to confirm the commits
  look right.

The Codex's own session shows the pattern: every section
ended with the agent verifying hygiene (running line-count
and forbidden-character checks against the file) and then
committing with a descriptive message. The pattern is small
and mechanical; it is also the difference between trusting
the agent's claim and verifying it.

## Common operations

1. **Land in a new subtree as an agent.** Read the
   `CLAUDE.md` or `AGENTS.md` if present. Read `README.md` if
   not. Skim the file structure. Ask what the briefing did not
   answer.
2. **Brief an agent for a task.** Goal in one sentence,
   constraints in two more, what is tried, what is out of
   scope, which files to read first.
3. **Open a worktree for parallel work.** From an existing
   checkout: `git worktree add ../encorpora-<branch> <branch>`.
   Open the new directory in the editor of choice; agents
   work there independently.
4. **Update auto-memory after a discovery.** Open the relevant
   file under `~/.claude/projects/.../memory/`. Add an entry
   with the fact, the why, and how to apply it. Update
   `MEMORY.md` index if a new file was created.
5. **Use plan mode for a big change.** Ask for "a plan, no
   edits yet." Review the plan. Edit the plan. Then ask for
   "implement the agreed plan."
6. **Read the diff before merging an agent's PR.**
   `gh pr diff <number> | less` shows the patch as text;
   `gh pr review --approve` only after the diff makes sense.

## Why we built it this way

The agent era has not replaced the discipline of reading the
code; it has shifted the discipline. Where a single human
engineer used to read every line they wrote, a human plus an
agent now reads every line the agent wrote. The reading is
still the load-bearing activity; the writing has gotten
faster.

CLAUDE.md and AGENTS.md files in subtrees are the smallest
investment that brings the next agent up to speed. The cost is
a few minutes of writing per subtree; the benefit is that every
session after starts from a higher baseline. The Codex itself
is this practice taken to its logical end: a doc that
explains the system to its future readers, human and agent.

Worktrees as the routine parallel primitive are the
acknowledgment that an agent can be working on Quest-Ear while
Jeff is working on Melopán while Skylar is reviewing a
narration pipeline change. The previous era's pattern (one
checkout, careful stash-and-pop, hope nothing is lost) breaks
down the moment three contexts are active at once.

The auto-memory pattern is the smallest mechanism for
preserving the "I learned this last week" context across
sessions. Without it, every session re-discovers the rules; with
it, the agent reads the rules in 60 seconds and applies them.
The cost (a few minutes per discovery, plus the discipline of
keeping the memory up to date) is paid in saved rediscovery
time many times over.

The pr-agent loop is the choice that scales review attention
across more PRs than a small team would otherwise handle. The
agent is not the reviewer of record; the agent is the second
pair of eyes that the human reviewer would otherwise have to
provide. The bandwidth gain is real.

## To go deeper

- The Claude Code docs at `docs.anthropic.com/claude/docs/`
  for the specific tool the auto-memory references; Cursor's
  docs at `docs.cursor.com/` for the equivalent in another
  shape.
- Anthropic's "Building effective agents" (web essay) for the
  general case.
- *The Programmer's Brain* (Hermans) for the cognitive
  background to why reading code matters more than writing it.
- Section 34 for what humans still do; section 35 for where
  this is going next.
