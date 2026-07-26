# Dynawalla — Experience design

The stakes model is [ADR-0009](DECISIONS/ADR-0009-stakes-without-loss.md). The ethics
list is in [MISSION.md](MISSION.md) and is not restated here.

## The core loop, in milliseconds

**Law: the work surface never waits for the world.**

| Moment | Budget | What happens |
|---|---|---|
| `T−N` idle | ≤50 ms per chunk | The generator produces problems N+1 and N+2 into an on-deck buffer inside `requestIdleCallback`. If any single `generate()` exceeds 4 ms measured, **move generation to a Worker** — do not optimise in place. |
| `T=0` PRESENT | 180 ms | The next problem is already in the DOM at `opacity: 0; translateY(8px)`; compositor-only transition. **No layout, no text measurement** — numerals sit on a fixed tabular grid so a 4-digit problem does not reflow after a 1-digit one. |
| `T=0→C` COMPREHENSION | not budgeted | The child's time. Measured, never limited. `timeToFirstKeyMs` and `timeToCommitMs` are recorded **separately** — long first-key is retrieval difficulty, long key-to-commit is execution difficulty. Corpán conflates them into one `latencyMs`; we will not. |
| every KEYPRESS | 0→16 ms visual, ≤50 ms handler | Bound on `pointerdown`. |
| COMMIT → JUDGEMENT | <1 ms | Synchronous and pure. Persistence happens *after* the verdict paints. |
| +≤16 ms FIRST FEEDBACK FRAME | one frame | Correct: glyphs seat into the carved recess with a cold celestial highlight. Incorrect: a chiselled strike mark, copper-oxide tone. **This frame is the whole product** and it depends on no world animation succeeding. |
| +≤220 ms SEAT | 200 ms | One detent click, one gear tooth, a `light` haptic, no particles — then 120 ms of earned stillness. The next problem presents concurrently with the reaction tail. |

**Cadence targets**, instrumented p50/p90 and never shown to the child: single-digit fact
2.8 s / 6 s; two-digit with regrouping 6 s / 14 s; the `5,001 − 2,798` class 16 s / 40 s.
**Machine-side contribution <120 ms** in every case (`Q-01`).

**Never on the answer path:** network, IndexedDB read, font load, image decode, model
load, or `await` of anything.

## Reaction vocabulary

| Tier | Name | Budget |
|---|---|---|
| −1 | SLIP | 260 ms |
| 0 | SEAT | 200 ms |
| 1 | ENGAGE | 450 ms |
| 2 | ILLUMINATE | 900 ms |
| 3 | MECHANISM | 1800 ms — once per session, always skippable |

Effects are drawn by an energy-weighted, non-repeating, eligibility-gated picker.

**Escalation is on difficulty and repair, never run length.** The reaction registry being
ported from Corpán escalates on `comboCount` via a combo-momentum function — exactly the
loop this product bans. Dynawalla scales tier on **`(b_item − θ_s)`** (harder problems
earn more) plus a dedicated tier-2 for **repairing a mal-rule you used to fire**. A unit
test asserts the weight function's signature takes no run-length or streak argument.

**Two more invariants, both unit tests:**

- `energy(SLIP) < energy(SEAT)`, where energy = budgetMs × particles × peakGain ×
  animatedElements. Being wrong must not be more interesting than being right.
- Nothing awaits a reaction. `settleNow()` is called synchronously by the input handler
  before any event is processed, and completes within 90 ms (`Q-04`).

**Reduced motion is a branch**, not a degradation: a 200 ms opacity cross-fade with zero
travel and no particles, verified in a test **and** in the committed screenshot set
(`Q-06`).

**Audio** is asset-free Web Audio: a struck felt-mallet timbre (sine + a 0.22-gain
triangle octave) over a C5–C6 pentatonic. Chimes are **dropped, never queued**, when
speech is active.

**Haptics** go through the native plugin — `navigator.vibrate` does not exist in iOS
WKWebView, so a WebView-only implementation silently does nothing on iPhone (`X-08`).

## Juice dose is a hard ceiling

In the largest study to date (N = 3,018), **both** None and Extreme juiciness
significantly decreased play time, player experience, intrinsic motivation and
performance versus Medium/High. A 2024 decomposition found that the
*success-dependence* of feedback enhanced all motives while raw amplification reduced
them.

Feedback must be **contingent, not loud**. The vocabulary is mechanical, not confetti:
gears engaging, counterweights rising, tesserae illuminating, a water clock advancing, an
automaton's eyebrow.

`energy(SLIP) < energy(SEAT)` is a proxy a determined designer can satisfy while still
making failure the interesting moment — a catapult falling short is inherently more
animated than a gear ticking. So it is **playtested specifically** (`T-01`), not just
unit-tested.

## Construction

Progress is a **building, not a flame with a number**. Every correct answer places
something real — a tessera, a gear tooth, a course of brick. **Construction never
regresses** (`P-04`): the child-safe version of loss aversion. The pull to return is "my
observatory is unfinished," not "my streak is at risk."

Technically procedural SVG, with completed chambers rasterized to snapshots. **That
rasterization is load-bearing from the first build, not an optimisation.** A hard cap of
~1,200 live SVG nodes with a failing perf test above it lands **before any art PR**,
because girih at 500+ answers becomes tens of thousands of nodes and will stall a
mid-range Android WebView (`Q-02`).

## The character — combinatorial, and rare

Twenty-one authored lines against 200–400 items per session is one line per 10–20
problems, repeating from minute six. The in-repo precedent for that architecture resolves
to "Perfect / Nice / Brilliant / Boom / Nailed it" — the exact generic cheerleader this
product forbids. Both fixes are taken.

**A grammar, not a line list.** ~8 observation types (got faster on X · fixed an error
you used to make · chose the harder route · first time on X · returned after N days ·
built the mechanism correctly · finished a chamber · noticed a pattern) × slotted
skill/instrument nouns × 3–4 phrasings ≈ 100 authored fragments, yielding thousands of
**true, specific** utterances at a bounded localization bill (`P-06`, `P-07`).

**Rarity as register.** The Dynawalla speaks **3–5 times per session**, at genuine
milestones. Silence is the personality. An automaton apprentice-master: ancient,
precise, dryly amused, never saccharine. It never says "Great job!" It says the specific
true thing.

Voice acting is deferred — TTS in a dry-ironic register is currently poor, and a
mis-delivered dry line reads as broken rather than laconic.

## Art direction

Ancient-futurist, sourced specifically: al-Jazari's 1206 *Book of Knowledge of Ingenious
Mechanical Devices* (50 machines he actually built; he introduced the camshaft) and the
Banū Mūsā's 9th-century *Book of Ingenious Devices*. Brass, lapis, carved stone, cold
celestial light. Girih strapwork as **structure**, not wallpaper. 2D throughout.

### Hostile reference board — what it must NOT look like

This list exists because "brass and lapis with procedural girih" is precisely the recipe
that renders as a gradient dashboard with gear icons, and code review cannot see the
difference. Every item here is a failure mode to check the screenshots against:

- **A SaaS dashboard.** Cards with drop shadows on a neutral background, a stat row, a
  progress ring, an accent colour used for "primary action". If a stranger says
  "dashboard," the gate has failed (`Q-14`).
- **A template.** Symmetrical three-column layout, evenly-spaced rounded rectangles,
  stock-icon set, a hero band at the top.
- **Steampunk.** Goggles, top hats, riveted copper plating, brass-for-brass's-sake.
  Gears must *do something* — a gear that does not turn a thing is decoration and is
  banned.
- **Gradient soup.** Purple-to-teal backgrounds, glassmorphism, neon glow. The palette is
  material, not lighting effects.
- **Confetti and starbursts.** Any particle vocabulary borrowed from a casual mobile
  game.
- **Emoji or cartoon mascots.** The character is an automaton, drawn in the same material
  language as the instruments.
- **Duolingo-adjacent.** Rounded sans-serif everything, a bouncing character, a streak
  flame, a green tick with a swoosh.
- **AI-generated "ancient" texture.** Wood-grain-and-parchment noise layers standing in
  for structure.

### The rendered-output gate

Code review cannot see that the observatory looks wrong. The repo already has a
device-pixel capture pipeline (`corpan/scripts/dev/ipad/screenshot.py` plus its CDP
driver) that the first draft of this plan never noticed.

M6 adds a deterministic seed set capturing the world at 0 / 50 / 200 / 500 placed
elements plus all five reaction tiers, at 320 px / 768 px / iPad, light and dark,
reduced-motion on and off. **The PNGs are committed and the images are reviewed in the
PR, not the code.** A named human art director signs off on those images as an exit
criterion.

The M6 stranger test: three strangers shown **only** the screenshots, unprompted, do not
use the word "dashboard" or the word "template."

## Agency, stakes, and stopping

Fully specified in [ADR-0009](DECISIONS/ADR-0009-stakes-without-loss.md). In summary: the
child chooses which chamber to build and that choice biases the scheduler; a completed
chamber's instrument actually operates and only correctly if built correctly; parts are
revealed by depth rather than gated by scarcity.

Designed stopping points offer **equal-weight** "Done" and "Keep going" (`P-10`). A
returning child after 30 days sees a restoration beat, not a punishment beat (`P-08`).

## The comparison that defines the target

The negative example is Prodigy: an FTC complaint alleging manipulative upselling to
children, with reviewers logging 16 membership ads in a 19-minute session. The positive
one is XtraMath — real spaced retrieval, ESSA Tier IV evidence — whose fair criticism is
that it "does not teach mathematical concepts or problem-solving."

**That criticism is the gap this product exists to fill**, which is why M2 must test
*that gap* and not juice-on-drill. An M2 that is merely fun proves nothing: juice on
drill is a solved, commoditized thing.
