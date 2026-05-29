# 34. What Humans Still Do

## What it is

The agent has gotten very good at writing code that compiles,
that follows conventions, and that passes the obvious tests. The
agent has not gotten good at deciding **which code to write**.
Architectural taste, product judgment, listening to a voice clone
and saying "that doesn't feel like Ian," reading a user's
feedback and choosing whether it reflects the next ten users or
just this one: these are the work humans still do, and the work
humans should still do.

This section is the inventory of that work in this project.
Section 33 covered how the team uses agents productively;
this one is the complement, the inventory of judgments the
agents are not asked to make.

## How it fits

Every architectural choice the Codex has documented started as a
human judgment. The decision to use Tauri instead of Electron
(section 04). The decision to use SQLite instead of a server
database (section 16). The decision to ship voice clones from a
single 15-second reference instead of training a per-voice model
(section 20). The decision to keep `gen/android/` and
`gen/apple/` regeneratable instead of hand-edited (sections 27,
28). The decision to keep the pack system as the architectural
centerpiece (section 10). Each is a judgment a human made,
explained, and committed to.

The agent contributes to executing each decision, sometimes with
significant volume. The agent does not get to undo any of them.

## Files and entry points

There is no specific file that holds "the human judgments." The
markers, throughout the codebase:

- `PIPELINE_STATE.md` at the repo root: documents the in-flight
  pipeline state, the calibration discoveries, the rules the
  human has set as non-negotiable (the "NEVER use --force on
  publish" list).
- `corpan/NARRATION_SYSTEM.md`'s "Why pre-generated audio, not
  on-device TTS" section: the seven-reason case for the
  pipeline's defining choice. This is a human framing.
- `corpan/APP_RELEASE_0_11_3.md`: the punch list, with
  human-set priorities and human-named tradeoffs.
- Every `Why we built it this way` section in this Codex: the
  rationale for each decision, written down so the next reader
  (human or agent) can see whether the rationale still holds.
- The auto-memory at
  `~/.claude/projects/.../memory/feedback_*.md`: feedback
  entries the user (Jeff) wrote because the agent's default
  behavior was wrong and the correction was non-obvious.

## How it works

### The judgments humans hold

A non-exhaustive list, drawn from the rest of the Codex:

- **What ships and what does not.** A pack's "ready" status is
  a human call. The validator's 12 checks (section 18) can pass
  and the audio can still feel wrong; the discipline is to
  listen.
- **Which features the app gains next.** The pack architecture
  (section 10) is what makes the next experience cheap; what
  the next experience **should be** is a Jeff call.
- **The voice character of a narrator.** Section 20 walks the
  Chatterbox cloning; the specific reference WAV and the
  per-language tuning are Jeff calls (with input from
  audition tests).
- **The visual identity of a pack.** Section 09 covers the
  styling stack; the specific palette (warm-earth-tones for
  Earthgate, the Stargate aesthetic family) is a design call.
- **The story a book tells.** Every book in `books/` is
  authored. Translations route through Claude subagents, but
  the source manuscript is human-authored.
- **The release decision.** When the app is "0.13.1 ready" is
  a Jeff call. The Codex documents the punch list (section
  27's reference to `APP_RELEASE_0_11_3.md`); the decision to
  declare done is not in the punch list.
- **The acceptable validator threshold.** The pipeline's
  thresholds (section 18's 12 checks) are calibrated against
  human listening. When the human ear says "this is fine" and
  the validator says "fail," the validator is recalibrated.
- **The rules the agent must follow.** The "no dashes in
  `tts.text` phonetic nudges" rule. The "do not edit
  `corpan/` from the codex worktree" rule. The "Cargo.lock is
  not committed" exception. Each is a human rule that the
  agent reads and obeys.
- **The trade between cost and quality.** The 64 kbps AAC
  choice (section 18). The "ship `medium` whisper for
  alignment, switch to `large-v3` for catalog-wide
  realignment" choice (section 21). Each balances a cost the
  human is willing to pay.
- **The decision to write something down.** When something is
  worth a comment in code, a doc, a memory entry, or a
  changelog entry. Sections 02 and 33 cover the practices; the
  decisions are case-by-case.

### The kinds of judgment

Three rough kinds:

- **Architectural**: "what shape should this take." The Tauri-
  over-Electron choice. The packs-over-monolith choice. The
  Spark-over-cloud-GPU choice. These are bets the team makes
  once and lives with for years.
- **Product**: "what should this do for the user." The "calm,
  earth-toned audiobook reader" identity of Earthgate. The
  "pass-the-device party game" framing of Parlometron. These
  are decisions about what the user is being offered.
- **Taste**: "how should this feel." The mastering chain
  parameters that make a voice sound like itself. The window
  size on desktop (1200 x 1000, not 800 x 600). The CSS
  custom-property defaults. These are decisions about
  experience quality.

The agent contributes to each kind in different ways: it can
prototype an architecture, draft a product spec, propose
several taste options. It does not get to settle any of them
without the human's nod.

### The trap: deferring judgment to the agent

The mistake to avoid: handing the agent a vague brief and
accepting whatever the agent produced because it compiled. The
agent will produce **something** for almost any input. The
question the human still has to answer is whether what was
produced is the right thing.

The mitigations the codebase encodes:

- **The CLAUDE.md / AGENTS.md files** name the conventions the
  agent should follow, so the agent's default is the project's
  default.
- **The reading-the-diff discipline** (section 33) ensures the
  human sees what the agent did before it becomes durable.
- **The auto-memory feedback entries** capture the "no, not
  like that" corrections so the agent does not re-make the
  same mistake.
- **The PR review by Skylar** is the second pair of eyes
  before the change reaches `upstream/main`.

Each is a small mechanism. Together they keep the human in
the loop where the judgment lives.

### The shift in skill emphasis

For the apprentice (the audience this manual is written for),
the skill emphasis has shifted in a specific direction:

- **Reading code** is more important than ever. The volume of
  generated code per hour has gone up; the comprehension rate
  has to keep up.
- **Writing prose** is more important than ever. The CLAUDE.md
  files, the comments, the auto-memory entries, the rationale
  paragraphs in `Why we built it this way` sections: all of
  these are what the agent reads next. Prose is the new
  scaffolding.
- **Naming things** is the central act of communication
  across the human-agent boundary. A well-named function
  steers the agent's next suggestion; a badly-named one
  doesn't.
- **Architectural pattern recognition** is what makes the
  judgments above repeatable. Knowing why Tauri-over-Electron
  was right here teaches you when the same family of choices
  is the right one elsewhere.

The skills that have **not** shifted: tracing a bug to its
cause, profiling a slow path, listening to a voice clone and
hearing the seam. These are the work humans still do because
they are the work humans are still better at.

## Common operations

1. **Make an architectural decision.** Write the decision
   down. Put it in a doc file (`PIPELINE_STATE.md`,
   `NARRATION_SYSTEM.md`, this Codex). Include the why and
   the costs.
2. **Correct an agent's default.** Add a feedback entry to
   `~/.claude/projects/.../memory/feedback_*.md`. Include why
   the correction is non-obvious.
3. **Audition a creative choice.** Listen to the voice. Read
   the prose. Look at the screenshot. The agent can produce
   variants; the human picks.
4. **Set a non-negotiable rule.** Write it in the relevant
   AGENTS.md or CLAUDE.md. Mark it clearly as non-negotiable.
   The agent reads it on every session.
5. **Resolve a conflict between agent suggestion and human
   instinct.** Trust the instinct; investigate to confirm.
   Update the memory or the rule if the investigation
   yields a generalizable lesson.
6. **Decide that a change is good enough to ship.** Read the
   diff. Test the change. Listen to or look at the output.
   Ship.

## Why we built it this way

The codebase invests heavily in agent-facing prose (CLAUDE.md,
AGENTS.md, comments, auto-memory) because the prose is where
the human's judgment lives. The agent's contribution is the
volume of code; the human's contribution is the direction. The
prose is what carries the direction across sessions, across
agents, across years.

The discipline of writing down rationale in `Why we built it
this way` sections (and in the equivalents throughout the
codebase) is the smallest investment that keeps the
architecture from drifting. A decision that is recorded can
be re-evaluated when conditions change; a decision that lives
only in the original author's head cannot. The Codex itself
is the bet that the rationale is worth writing down at the
scale of the whole system.

The acknowledgement that humans are still better at some
things is not a defensive claim; it is the basis for working
together productively. A human who pretends the agent is
better at every kind of work will hand off judgments the
agent cannot make. An agent that pretends the human's
judgment is always right will not flag the cases where the
human has missed a relevant constraint. The honest division
of labor (humans for direction and judgment, agents for
volume and execution) is what makes the partnership work.

The apprentice the Codex is written for inherits both halves
of this work. The skill set is "read code, write prose, name
things, recognize patterns" plus "trace bugs, listen
carefully, hold the architecture in mind." Section 35 closes
this part of the manual with a brief look at what comes next.

## To go deeper

- *The Pragmatic Programmer* (Hunt and Thomas) for the case
  that prose-around-code is part of code; this codebase is a
  direct expression of that case.
- *Designing Data-Intensive Applications* (Kleppmann) for the
  systems-judgment vocabulary the Codex's architectural
  decisions draw on.
- *The Mythical Man-Month* (Brooks) for the second-system
  effect and the conceptual integrity argument that
  underlies this section's "judgment, not volume" framing.
- Section 33 for the agent-facing side of the same
  conversation; section 35 for what changes next.
