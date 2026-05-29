# 35. The Near Future

**Snapshot at 2026-05-29.** This section is dated speculation,
explicitly. The other sections of the Codex describe the system
as it stands; this one describes where the team's attention
points next. Things move; the speculation will age. Read the
date at the top before trusting the predictions below.

## What it is

A small set of directions the project is already pointed in,
plus a smaller set of larger bets that are plausibly the next
phase. Each entry is one or two paragraphs; each is qualified
with what would have to be true for it to happen.

## How it fits

The Codex describes a system in motion. Every other section
captures a moment; this one captures the direction of motion.
The intended reader is a Jeff or a Skylar coming back in six
months with the question "did we end up doing what we said we
would?"

## How it works

### Near (next few months)

**Pronunciation coach matures.** Parlometron (v0.13.x) shipped
the pass-the-device party game on top of the existing
pronunciation infrastructure. The next several releases tune
the scoring per language, expand the language set beyond the
current 51, and ship the bigger Whisper models on devices
that have the memory headroom. The catalog-side audit (which
voices, which models, which prompts) is partly automated, but
the per-language tuning is human work.

**More books, more languages.** The current shipped scale is
seven books across ten languages (per
`NARRATION_SYSTEM.md`). The pipeline is engineered for the
order of 50+ books across 25+ languages; the next several
months are about adding both. The Fascinating Curiosities
twelve-volume run, the Tolstoy short stories, the Soccer
series, Genesis: each is queued.

**The pack catalog grows.** New reading-style packs (Stargate
Reader is shipping; Earthgate continues to grow; new ones in
the same `@shared/catalog` shell are queued). New non-reading
packs (Melopán's music sandbox is on a branch; Quest-Ear's
v0.4.0 Rat King final boss is uncommitted per auto-memory).
Each new pack ships as its own changelog (section 02); the
catalog absorbs them.

**Apple Vision Pro / spatial computing.** Tauri's iOS path
runs on visionOS. The question is whether the reading
experience makes sense in a spatial context; the answer is
probably yes for the long-form reader and probably no for the
pronunciation coach (which wants a face-forward microphone).
No work scheduled; pencil only.

**Web Codex.** This Codex itself shipping as a browsable
web artifact at encorpora.io or under a sibling subdomain. The
current shape (markdown files in `codex/`) is already
browsable on GitHub; a static-site build (eleventy, Astro, or
Vite-MDX) is the next obvious step. Trivial cost; meaningful
reach.

### Medium-near (six to eighteen months)

**Device-to-cloud user state.** Section 26 flagged the
deliberate absence of cloud sync. The day the second-device
cost outgrows the architectural simplicity of "no backend" is
the day to add minimal user state sync. The minimum viable
shape is anonymous-account-per-install with a server that
stores the settings store, the history store, and the
installed-pack list. Identity probably ties to Apple ID or
Google sign-in; the Corpora platform code (the sibling repo
the encorpora README references) may absorb this work.

**A real `Brewfile`.** Section 32 noted the absence. A
committed `Brewfile` at the repo root reduces the fresh-machine
setup time meaningfully and documents the system-binary
dependency surface in one place. Small change, real value.

**Deterministic `gen/` rebuilds.** Section 27 flagged the
"longer-term ideal" of gitignoring `gen/apple/` and
`gen/android/` once the regen scripts are deterministic
across machines. The prerequisites are several specific
template-layer fixes (the iOS entitlements toggle through
project.yml, the Android manifest merge for BILLING). When
those land, the `.gitignore` move is mechanical.

**Catalog-versioned pack delivery.** Today, when a pack
publishes a new version, the catalog is updated and existing
installs continue to play the old version until the user
reinstalls. A future shape: the catalog declares "the current
canonical version is X; you have Y," and the app prompts the
user to update at a natural moment. This is design work as
much as engineering work; the right place for the prompt is
not obvious.

### Larger bets (twelve to twenty-four months)

**On-device TTS catches up.** Section 18's "Why pre-generated
audio, not on-device TTS" case held in 2024 and holds in
2026. It will not hold forever. When on-device voice cloning
becomes shippable (smaller models, better quality), the
pipeline will not become obsolete (the QA bar is the QA bar)
but the runtime mix may shift. Some content may be
pre-generated; some may be on-device; the line moves.

**The Corpora platform absorbs more.** The README's
"experiments graduate" framing has been the working model
since the start. Several of the in-encorpora components
(`tauri-plugin-iap`, parts of the catalog, the audio engine in
`@shared/audio`) are stable enough to graduate. When they do,
the boundary between encorpora and corpora shifts; the Codex
acquires a sibling document covering the stable side.

**A Codex of Codexes.** This document is one specific
manual for one specific codebase. The pattern (a manual that
braids reference and education) is portable; the team may
find itself wanting a parallel Codex for the Corpora platform
when that codebase is mature enough to deserve one.

**The agent era keeps changing.** Whatever the agents are
doing in eighteen months will be different from what they
are doing today. The patterns the codebase invests in
(CLAUDE.md, AGENTS.md, auto-memory, decision logs) are
betting on the shape of "agents read prose, humans write
prose, humans hold judgment" being durable across model
generations. If the bet is right, the patterns scale; if it
is wrong, the next Codex will document a different shape.

## Common operations

The "common operations" idea does not quite apply to a
prediction section. The closest is:

1. **Revisit this section.** Six months from this date,
   read it back. Note what came true, what did not, what
   surprised. The exercise calibrates future predictions.
2. **Add a new prediction.** When a Jeff or a Skylar says
   "we're going to do X next quarter," write it here with the
   date and the qualifier.
3. **Remove a stale prediction.** When something here turns
   out to be wrong (the timeline slipped, the bet did not pay
   off), say so explicitly; do not silently delete.

## Why we built it this way

A dated speculation section is the smallest mechanism for
keeping the manual honest about its limits. The other
sections claim to describe the system; this one claims to
describe one moment in the team's attention. Mixing the two
would let speculation rot the rest; separating them lets the
speculation be useful without being mistaken for
documentation.

The convention to mark the date and qualify each prediction is
the equivalent of "Why we built it this way": a prediction
with its conditions attached can be re-evaluated when the
conditions change. A prediction without conditions is just an
opinion frozen in time.

The decision to keep this section short (and to keep the
predictions modest) is deliberate. Long lists of "what we
might do" rot fastest; short lists of "what we are actually
about to do" age better. When in doubt, prefer the second
shape.

## To go deeper

- Section 36 for the dated history of what the system has
  done; this section pairs with it.
- The auto-memory at
  `~/.claude/projects/.../memory/` for the team's current
  per-pack work (Melopán's status, Quest-Ear's branch state),
  which is the freshest signal of where the next few weeks
  will go.
- `PIPELINE_STATE.md` at the repo root for Skylar's current
  view of the narration pipeline's state and priorities.
