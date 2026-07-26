# Dynawalla — Adaptive learning

The learner model, the scheduler, the invariants, and the harness that is supposed to
falsify all of it. Scheduling decisions that are irreversible are in
[ADR-0008](DECISIONS/ADR-0008-fsrs-on-classes-latency-rating.md).

## Three layers

### S — skill proficiency

```
P    = c + (1 − c)·σ(θ_s − b_item)          c = guess floor: 0 free entry, 1/k choice
θ_s += U(n_s)·w·(y′ − P)                    U(n) = 0.9 / (1 + 0.06n)
```

Asymmetric credit (×1.0 correct, ×0.7 incorrect) so one mis-tap never craters a child.
0.15× residual propagates to direct prerequisites.

### F — fact memory

FSRS-6 over the bounded **~180** enumerable V1 facts (add/sub within 20, the ×/÷
tables), behind a one-file `Scheduler` seam with a test pinning the 21 default weights so
a library upgrade fails loudly.

Two things about it are non-obvious and both are load-bearing —
[ADR-0008](DECISIONS/ADR-0008-fsrs-on-classes-latency-rating.md):

- **Keyed on classes, never instances:** `skill:<id>#L<level>#<formId>`. Generated
  exercises have no stable id, so per-item keys would mint a new card per instance and
  silently degenerate spaced review into random practice.
- **The rating is a function of `(correct, latency)`, not correctness alone.**
  Fast-correct → Good/Easy; **slow-correct → Hard, with the interval capped**;
  incorrect → Again. Card creation is gated on `φ_s` crossing a fluency threshold, so
  facts the child still *computes* stay in the Layer-S fluency-burst pool.

### B — misconception tracker

Per `(skill, bugId)`: `β ← 0.9·β + 1{bug fired}`, active at `β ≥ 2.2`. It never subtracts
from `θ`; it *gates* mastery and triggers repair.

## Rejected alternatives, with reasons

| Approach | Why not |
|---|---|
| BKT | Needs per-skill fitting we cannot do; confirmed semantic degeneracy; over-predicts collapse after a single failure — structurally punitive, which is disqualifying for children. |
| DKT / SAKT | No corpus; ships a model artifact; cannot answer "why this exercise". |
| Full IRT calibration | Needs ~200 responses per item. Undefined with zero users and infinitely many generated items. |
| SM-2 / Leitner | FSRS-6 dominates SM-2 on the open benchmark; Leitner gives no retrievability estimate. |
| FSRS over everything | Wrong unit. `34 + 29` is computed, not recalled. |

## Cold start

**No placement test.** One grade question seeds `θ_s^0 = b̄_s − 0.4` at or below the
band and `b̄_s − 2.0` one band above. The first 20 exercises are a scripted-but-adaptive
ladder inside the fiction (winding the first automaton), never labelled a test, and **no
card in the first 20 may have `P̂ < 0.55`.**

## Difficulty target

**0.80**, band [0.70, 0.92].

Not 0.85: Wilson's 85% rule is derived for stochastic-gradient binary classifiers and its
authors scope it there. The closest real prior art (Math Garden — 3,648 children, 3.5M
problems) samples at 0.75. Corbett & Anderson's 0.95 is a *mastery confidence*, not a
success target.

**Controller.** `pTarget ← clamp(pTarget + 0.06·fail − 0.015·pass, 0.70, 0.92)`, updated
**per item**, and the batch is **re-planned on any invariant trip** rather than served to
completion — otherwise a correction lands one batch late and reads to the child as the
app randomly getting easy and then hard.

**Batch composition is expressed as offsets from `pTarget`, never absolute `P̂`.** "One
stretch item" means `pTarget − 0.07`, not a fixed 0.85 that is a stretch at the top clamp
and a gift at the bottom. This is the boundary conflict the first draft had.

Harness assertion: over any 50-item window, per-item `|ΔpTarget|` stays under bound and
its sign does not alternate more than N times (`A-09`).

## Scheduler pools

`REPAIR` · `PREREQ` · `DUE_FACT` · `FRONTIER` · `NEW` · `FLUENCY` · `REVIEW_SKILL` ·
`CHALLENGE` · `PLAY`.

Batches are 8 cards. The child's chamber choice biases the pool toward that instrument's
mathematics ([ADR-0009](DECISIONS/ADR-0009-stakes-without-loss.md), `P-05`).

**Interleaving:** within any batch of 8, ≤2 consecutive from one skill, ≤3 from one
operation, ≥3 distinct skills once ≥3 are reachable. **Exception:** a brand-new skill
gets a blocked debut of 3–4 consecutive guided items.

Interleaved practice *impairs* in-session performance while roughly **doubling**
next-day test scores. Surface that trade-off in Developer Mode so nobody "fixes" the
deliberately depressed in-session accuracy.

## Corrective feedback — three stages

**Stage 1 VERIFY** (first error, unclassified). Quiet. A strike mark, the correct answer
seated beside it, one retry at `b = θ_s − 0.8`. No lecture. Evidence weight 0.5, no
repair scheduling.

**Stage 2 LOCATE** (mal-rule matched, `β ≥ 2.2`). The mechanism the product is named
for. If the wrong answer *equals* a computed buggy-procedure output, we know which step
broke. On `5,001 − 2,798 = 3,203` — `mis.add.borrow-across-zero`, the variant that
regroups all the way down but never decrements the thousands — the response is a
**contrast pair** in which the buggy procedure produces a visibly absurd answer: on the
counting board the thousand that was spent to feed the hundreds is still sitting in the
answer, and adding back gives `6,001`, not `5,001`. The child sees the contradiction
rather than being told.

Two different mal-rules produce two different wrong answers on this one problem, and
they are not interchangeable. The correct answer is `2,203`. `3,203` is
borrow-across-zero — it is the correct answer plus exactly the 1,000 that was borrowed
and never given up, which is what makes the counting board a real contradiction rather
than an illustration. `3,797` is `mis.add.smaller-from-larger` (`|5−2| |0−7| |0−9|
|1−8|`); it is not off by a place-value unit at all and its contrast is the number line,
not the counting board. Binding one rule's LOCATE representation to the other rule's
output is exactly the mapping error `CG-12` cannot catch, because both rules are
individually valid and both diverge from the correct answer on ≥95% of seeds.

**Scoped honestly.** There is no generic "make the contradiction self-evident" function:
fraction addition needs a bar contradiction, magnitude comparison needs a number line. So
LOCATE is built for the **8–12 mal-rules where a representation is genuinely
load-bearing and the evidence base is real** — place-value regrouping, fraction addition,
decimal comparison, division remainder — split by representation family across several
PRs. Every other mal-rule routes to Stage 3. Gate CG-22 enforces that only LOCATE-capable
mal-rules are tagged as such, so Developer Mode and any external claim can be checked
against the actual count.

Repair items are capped at ≤25% of any batch (`A-12`). **Playtested specifically**
(`T-05`): being handed a second, weirder problem after getting one wrong is a plausible
way to lose a child.

**Stage 3 RECONSTRUCT** (repeated failure or no match). A **faded worked example** —
fading reduces extraneous load for novices and the faded step itself increases
self-explanation, improving near- and far-transfer — then a 1–2 item probe of the weakest
prerequisite, descending only on further failure. Return to the skill no sooner than 3
cards later.

## Discriminations most engines get wrong

**Slow-but-correct vs fluent.** `θ_s` = can do it; `φ_s` = does it without counting.
Low-`φ`/high-`θ` gets **short fluency bursts at `P̂ ≈ 0.90`, never harder problems**, and
a hard assertion says **no skill promotion is ever denied on latency alone** (`A-05`).

**Slip vs misconception.** Four discriminators: exact mal-rule match; decayed recurrence
`β`; **self-correction** (revisions > 0 then correct → slip, never a bug increment — the
cleanest signal available); and latency shape (slips fast `z < 1`, misconceptions
confident `z ≈ 1`, "no idea" `z > 2`).

**Lucky guess.** The `1/k` floor shrinks credit automatically; a correct-but-implausibly-
fast choice gets weight 0.3; **choice items can never advance a skill past Practiced**;
and any correct choice on a not-yet-Practiced skill is followed by a free-entry twin in
the same session. Past credit is never retro-edited.

## Fatigue as an anti-punitive mechanism

Indicators: rising latency EWMA with accuracy holding; accuracy down ≥20 points versus
the session's first third; minutes past the child's personal EWMA. **Any two** →
fatigued → evidence weight 0.5, `pTarget` to 0.90, no new skills, no repair, and a
stopping point at the next narrative beat.

Assertable: replaying with the post-fatigue window excluded yields an **identical** set of
skill levels — zero demotions attributable to tiredness (`A-07`).

## Invariants — each a named unit test

Anti-frustration:

- Never re-serve an identical item within 6 cards.
- Never two consecutive items below `pTarget − 0.20`.
- Never more than 2 failures in any window of 5 without forcing a `pTarget + 0.10` card.
- After 3 failures on one skill it is benched for the session.
- **Never end a session on a failure.**
- First and last card of every session at `pTarget + 0.10`.

Anti-stagnation:

- Every batch has ≥1 item at `pTarget − 0.07` once one skill is Practiced.
- If the last 24 items were all easy with accuracy ≥0.95, force a promotion probe.
- A Mastered skill unfailed for 21 days is **Retired** from normal pools.
- ≤40% of a rolling 50-item window from any one skill.
- If 3 sessions pass with `θ` improving <0.3, the scheduler **goes around** and re-queues
  the stuck skill in a *different representation*.

That second set is not polish. Tripling practice on one problem type (3 → 9 problems) had
**no effect** on 1-week or 4-week test scores. Without the window cap and the Retired
state, a child who is good at times tables gets times tables forever — which is the
difference between a tutor and a treadmill.

## Persisted state

Bounded by construction, and the sum is stated so the next reader can check it:

```
SkillState      24 B × 160   =   3,840
FactCard        20 B × 180   =   3,600
BugState        12 B ×  64   =     768   sparse, hard cap
LearnerState                 =   1,024
SessionRollup   64 B × 180   =  11,520   last 180 days daily, older collapsed monthly
Event ring      32 B × 512   =  16,384   FIFO, Developer Mode only
                                -------
                                 37,136 B  ≈ 36 KiB
```

**It does not grow with sessions.** Every component is a fixed-size array or a capped
ring, so the 500-session measurement in `A-15` / `EG-3` reads the same number as the
5-session one. The ~60 KB of headroom under the 100 KB bound absorbs codec overhead and
leaves room to widen the ring later without renegotiating the gate.

The first draft budgeted a 2,000-event ring and 730 daily rollups, which totals ~116 KiB
— it busted its own acceptance bound. The ring and the rollup depth are the two knobs;
both are capped here, not "downsampled" aspirationally.

All model state is sufficient-statistic-shaped. The event log exists only for Developer
Mode, the parent report, and future recalibration.

## Developer Mode

Every served card carries an immutable `SelectionTrace` produced by the **same code path
that made the decision**:

```
{ cardId, skillId, pool, bTarget, bActual, pHat, pTargetBand, reasons[], rejected[], rngDraws, seed }
```

Golden-transcript tests assert on traces, so the explanation can never drift from the
behaviour. Compiled out in production.

## The simulation harness

**It was circular and it has been fixed.** The original reliability gate had the engine
computing `σ(θ − b)` while the persona answered from `σ(α − b)` against the *same* `b` —
so the check passed by construction and measured nothing.

**Corrected:** personas answer from a **3PL with per-child discrimination `a_i` and item
features the engine cannot observe** (visual load, digit count, working-memory span),
plus one explicit **misspecification persona** whose true `b` differs from the engine's
by a structured offset. EG-5 then measures robustness, which is what it was supposed to
do.

**And a real-child anchor before content breadth is bought:** residuals from the M2
playtest cohort are fitted against predicted `b` and committed as a fixture
(`T-03`, `A-02`). If that fit is skipped "until there is more content," the engine is
unvalidated all the way to launch.

**Eleven personas: ten behavioural plus one misspecification.** The ten behavioural ones
are steady-strong, struggling, fast-careless, slow-accurate, **accurate-counter-on**,
single-misconception, returning-lapser, pure-guesser, rapid-improver and fatiguer. The
eleventh — the misspecification persona — is EG-5's instrument rather than an outcome
persona: it runs in the calibration set only, so the nightly outcome budget below is ten
personas, not eleven. `EG-8` in [GATES.md](GATES.md) maps each persona to its acceptance
item, and says which five have none.

**The synthetic child acquires skill from day one** (`α += 0.08` per spaced success, cap
+1.5, no same-day credit). Corpán's harness modelled **fixed** ability, which made 3 of
its 11 ship gates mathematically unsatisfiable under any scheduler and cost two full
calibration rounds plus a spec amendment to discover.

**Runtime is budgeted.** Corpán's measured harness (25 learners × 180 days × 7 personas)
takes 315.8 s. Ten behavioural personas × 100 children × 3 seeds is 5–12× that — 30–80
minutes, plus the misspecification persona in the EG-5 calibration set. It is a
**nightly job with a named owner**, never a per-PR check; PRs run a 3-persona ×
20-learner smoke.

**Every gate is labelled REGRESSION BOUND** (derived from a pilot run) **or PEDAGOGICAL
ASSERTION** (derived from theory), and "a different marginal leg fails on each seed" is
reported as a FAIL, not as noise (`A-14`).
