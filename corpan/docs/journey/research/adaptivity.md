# Journey Adaptive Engine — Research + Spec

**Role: adaptive-learning-engine lead. Status: v0.1 research deliverable, 2026-07-03.**
**Scope: 100% on-device memory scheduling (FSRS), knowledge tracing, placement, dynamic difficulty, and the feed-mixing algorithm. No server, no telemetry dependency, no pretrained student models.**

Companion docs: `NORTH_STAR.md` (product), `codebase/app-shell.md` (stores/persistence), `codebase/pack-contract.md` (activity result seam), `codebase/content-data.md` (course-pack SQLite plan).

---

## 0. Executive design summary

- **Memory scheduler: FSRS-6** via the `ts-fsrs` npm package (v5.4.x, MIT, pure TS, FSRS-6 with 21 parameters incl. the personalizable forgetting-curve decay w20). Ship default weights; no optimizer needed at launch; optional on-device parameter optimization later (fsrs-rs WASM) once a learner has ~1,000+ review logs.
- **Knowledge tracing: NO BKT, NO DKT.** Skill mastery is a *derived* quantity: coverage × mean FSRS retrievability of the skill's items, gated by a recall-level accuracy EWMA. One extra scalar per course — an Elo/IRT-style ability θ (the "Birdbrain-lite" number) — drives placement and difficulty targeting. Zero training data required, every number interpretable, trivially serializable.
- **Placement: a 3-phase adaptive probe** (coarse band jump → Elo-updated refinement → frontier confirmation), 12–25 items, ~3–6 minutes, ends with a provisional frontier + "prior-known" seeding of skipped material (lazy FSRS card creation with boosted initial stability).
- **Dynamic difficulty: a per-session flow controller** (cruise/normal/struggle states from a windowed performance signal) that escalates exercise *form* (recognition → cued recall → free production) when cruising, de-escalates and injects scaffolding when struggling, and offers explicit "Jump ahead" checkpoints (Duolingo-style test-out: limited mistakes, no hints) when cruise persists.
- **Feed mixing: slot-template sampler** over four pools (due-review, new-intro, weak-repair, fluency/fun), with interleaving constraints (no identical activity types adjacent, ≥3 cards between repeats of the same item, failed items replayed same-session — FSRS-6's same-day stability math, w17–w19, makes this sound).
- **State fits on device easily**: ~64 bytes/item logical state; 25k items ≈ low single-digit MB. Store in the IndexedDB LARGE tier (per `app-shell.md:136` — do NOT put per-item state in the ~5MB shared localStorage budget), keyed per (profile/stack, course).

---

## 1. Memory scheduling: FSRS-6

### 1.1 Why FSRS-6, and which implementation

FSRS is the current best-in-class open spaced-repetition scheduler (tops the open [srs-benchmark](https://github.com/open-spaced-repetition/srs-benchmark) against SM-2, HLR, and most neural schedulers at far lower complexity). FSRS-6 is the current generation: it adds an **optimizable forgetting-curve decay parameter (w20)** so curve flatness is per-learner, and it has an explicit **same-day (short-term) review model** (w17–w19) — which we need, because our feed intentionally re-shows failed items within the same session.

Implementation choice: **`ts-fsrs`** (open-spaced-repetition org, MIT, pure TypeScript, ESM/CJS/UMD). Latest is 5.4.1 (2026-05-22); the 5.x line implements FSRS-6 (21 parameters) and learning-steps handling ("prevent skipping of learning steps" fix landed in 5.3.1). It runs fine inside the Tauri WebView — no native code, no WASM required for *scheduling*. (The Rust `fsrs` crate / `fsrs-browser` WASM build is only needed later for on-device parameter **optimization**, which is a batch job, not a hot path.)

- npm: https://www.npmjs.com/package/ts-fsrs — repo: https://github.com/open-spaced-repetition/ts-fsrs
- Algorithm reference: https://expertium.github.io/Algorithm.html
- rs-fsrs overview: https://deepwiki.com/open-spaced-repetition/rs-fsrs/3.1-fsrs-algorithm-overview

### 1.2 The model in one page (what we actually depend on)

Each item carries three memory variables:

- **S — stability**: days for retrievability to fall to 90%.
- **D — difficulty** ∈ [1,10]: dampens stability growth for hard items (`(11−D)/10` factor).
- **R — retrievability**: predicted recall probability *right now*:
  `R(t, S) = (1 + FACTOR · t/S)^(−w20_decay)` (power forgetting curve; FSRS-6 makes the decay a fitted parameter; for default params, when t = S, R = 0.9).

Update rules (all implemented inside ts-fsrs; listed so we can reason about behavior):

- **First review**: S₀ = w[grade−1] (w0..w3 for Again/Hard/Good/Easy); D₀ from w4/w5 with clamp to [1,10].
- **Successful review**: S′ = S · SInc, where SInc ≥ 1 multiplies three interpretable factors — harder item ⇒ smaller gain (`(11−D)/10`); higher current S ⇒ smaller relative gain (saturation via w9); lower R at review time ⇒ *bigger* gain (spacing effect via w8) — times grade modifiers w15 (Hard, <1) / w16 (Easy, >1).
- **Lapse (Again)**: post-lapse stability via w11..w14, hard-capped at min(·, S) — a lapse can never *increase* stability.
- **Same-day reviews**: separate short-term stability update via w17–w19, with the constraint S′ ≥ S when grade ≥ Good. This is what lets us replay a failed card 3 minutes later without corrupting the long-term schedule.
- **Difficulty update**: grade-driven ΔD with linear damping (can't pin at 10) + mean reversion toward the Easy-default (w4/w7).
- **Interval from desired retention**: `interval = (S / FACTOR) · (DR^(−1/decay) − 1)`; at DR = 0.9 with default decay, interval ≈ S.

### 1.3 Cold-start defaults (ship these verbatim)

FSRS-6 default parameters (21 weights, fitted on ~10k Anki users' data; source: fsrs4anki / ts-fsrs defaults):

```
w = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
     1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
     1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```

Config (ts-fsrs `generatorParameters`):

- `request_retention` (desired retention): **0.90** default. Expose internally as a "pace" knob later (0.85 = fewer reviews/more forgetting; 0.93 = review-heavy); never expose the raw number to users.
- `maximum_interval`: 365 days (course content churns; longer adds nothing).
- `enable_fuzz: true`, deterministic seed = hash(itemId) — ±small% interval noise prevents review-load clumping (whole placement cohorts coming due the same day).
- `enable_short_term: true` — required for same-day replay (§5.4).
- Learning steps: **none** (0 steps). Our feed *is* the learning-step mechanism — a failed/new item is re-queued in-session by the mixer, not by sub-day scheduler steps. This keeps `due` semantics purely day-granular and the feed in charge of intra-session pacing. (ts-fsrs supports steps if we change our mind.)
- **Per-learner optimization: OFF at launch.** Defaults are within a few % log-loss of personalized weights for most users. Revisit at ≥1,000 review logs per course via fsrs-browser (WASM) as a background batch job. We already persist the review log (§3.4) so this is purely additive later.

### 1.4 Grade mapping — activities don't have 4 buttons

Journey activities produce objective results (correct/incorrect, latency, hints, STT scores), not self-graded Again/Hard/Good/Easy. Evidence says this is fine — FSRS is *more* accurate for users who mostly use Again/Good than for heavy 4-button users, and the one hard rule is **Hard is a pass, never a fail** ([Anki forums / fsrs4anki tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md)).

Deterministic mapping (per activity result envelope, §3.3):

```
function toGrade(result, item, profile):
  if !result.correct                       → AGAIN
  # latency normalized against a personal, per-activity-type baseline
  z = result.latencyMs / expectedLatency(profile, result.activityType, item.length)
  if result.hintsUsed > 0 or result.retried or z > 2.0        → HARD
  if z < 0.6 and result.firstTry and item.reps == 0-context-free
                                            → EASY   # keep rare; see below
  else                                      → GOOD
```

- `expectedLatency` = running median (P50) of the learner's correct-response latencies per activity type, scaled by item text length; seeded with static per-activity-type constants (e.g. tap-choice 3.5s, type-translation 12s, speak 8s). Store as an EWMA pair (median-ish via P² or simple EWMA of log-latency) per activity type — 8 floats total.
- **EASY is intentionally stingy** (fast + first-try + no hints). Overusing Easy explodes intervals; Good is the workhorse. Multiple-choice/recognition activities can never award EASY (guessable formats cap at GOOD).
- **Guess control for MC formats**: a correct answer on a 4-choice recognition activity is weaker evidence than typed production. Rather than perturbing FSRS grades, this is handled in *activity-form escalation* (§6): items only count toward level-up at recall-level forms, and the mixer prefers stronger forms as R and mastery grow.
- **Self-report**: the only self-report we use is the placement/new-item shortcut "I already know this" → treated as first-review EASY (S₀ = w3 ≈ 8.3 days) with a `priorKnown` flag; and an optional post-lapse "I never learned this" → resets to new.
- **STT results**: pronunciation-coach's `SttTranscriptionResult` (`pack-contract.md` §1.7 — richest outcome in the system, currently discarded at the pack boundary) maps via `overallScore`: <0.45 AGAIN, 0.45–0.7 HARD, 0.7–0.9 GOOD, >0.9 EASY-eligible.

---

## 2. Knowledge tracing: the deliberately boring choice

### 2.1 Options considered

| Option | Verdict | Why |
|---|---|---|
| **DKT / SAKT / neural KT** | ❌ Rejected | Needs training data we don't have, uninterpretable, a model artifact to ship/version per course, and published results show tuned BKT variants match DKT AUC on standard datasets anyway ([EDM 2016 "Going Deeper with DKT"](https://www.educationaldatamining.org/EDM2016/proceedings/paper_133.pdf)). Zero benefit at our data scale (one learner, on-device). |
| **Classic BKT** (P(L₀), P(T), P(G), P(S) per skill) | ❌ Rejected as primary | Its four parameters must be *fit per skill* to mean anything; unfit hand-set BKT is just a fancy EWMA with extra state and false precision. Also BKT models a *latent binary* "learned" state — but we already have a far richer per-item memory model (FSRS S/D/R). Running both creates two disagreeing sources of truth. |
| **Derived mastery from FSRS + accuracy EWMA** | ✅ **Primary** | Zero new parameters, zero training, always consistent with the scheduler, fully interpretable, recomputable from item state (crash-safe). |
| **Elo/IRT ability scalar** (Birdbrain-lite) | ✅ **Secondary** | Duolingo's Birdbrain is IRT-flavored logistic regression over (learner ability, exercise difficulty) ([IEEE Spectrum](https://spectrum.ieee.org/duolingo)). We keep exactly one online-updated ability scalar θ per course for placement + difficulty targeting. Item/skill difficulties `b` ship **statically in the course pack** (author/generator-assigned from CEFR band + frequency rank) — nothing is trained on device. |

### 2.2 Skill mastery (derived, recomputed on read)

For skill `s` with item set `I(s)` (an item may belong to multiple skills; count it in each):

```
seen(s)      = { i ∈ I(s) : card exists }
coverage(s)  = |seen(s)| / |I(s)|
strength(s)  = mean over seen(s) of R(now, S_i)          # FSRS retrievability
acc(s)       = EWMA(α=0.3) of correctness on RECALL-level activities for items in s
mastery(s)   = coverage(s) × strength(s)                  # ∈ [0,1]
```

`mastery` is *never stored as truth* — it's recomputed from item cards + the per-skill accuracy EWMA (the only stored per-skill scalar besides level). This makes state repair trivial and keeps one source of truth (item cards).

### 2.3 Ability scalar θ (per course)

- P(correct) model: `P = σ(θ − b_item)` where `b_item` is the static difficulty shipped in the course pack (logit scale, roughly CEFR-anchored: A1 core ≈ −3 … C2 literary ≈ +4).
- Update on every scoreable result: `θ ← θ + K · (y − P)`, y ∈ {0,1}; `K` decays 0.5 → 0.08 with result count (fast placement convergence, stable long-run).
- Uses: placement (§4), choosing distractor difficulty and activity form, sanity-checking level-skips. θ is advisory; FSRS owns memory, the DAG owns sequence.

---

## 3. Data model

### 3.1 Where it lives

Per `app-shell.md:136`: a `store/journey.ts` zustand store is fine for the *small* state (levels, θ, session context), but per-item card state over up to ~25k items **must** use the IndexedDB LARGE tier (house precedent: `corpan-catalog-v2`, `store/catalog.ts:185-188`). Keying follows the stacks/profile pattern: everything below is namespaced by `courseId` (= target lang) and profile/stack, mirroring `history.ts`.

Course content (skill DAG, items, static difficulties, activity templates) ships **read-only** in the course-pack SQLite (`content-data.md` §6); learner state never lives in the pack.

### 3.2 Types (canonical, serialized)

```ts
// ---- per item (the only heavy table; lazy-created on first encounter) ----
interface ItemCard {
  itemId: string;          // course-pack item id
  s: number;               // FSRS stability (days, f32)
  d: number;               // FSRS difficulty 1..10 (f32)
  due: number;             // epoch DAY (int; day granularity on purpose)
  last: number;            // epoch day of last review
  reps: number; lapses: number;      // uint16 each
  state: 0|1|2|3;          // New | Learning | Review | Relearning (ts-fsrs enum)
  flags: number;           // bitfield: priorKnown | placementSeeded | leech | suspended
  form: 0|1|2;             // highest activity form passed: recognition|cuedRecall|production
}
// ~64 bytes logical; 25k items ≈ 1.6 MB serialized. IndexedDB LARGE tier.

// ---- per skill (tiny; one row per skill node, a few hundred per course) ----
interface SkillState {
  skillId: string;
  level: 0|1|2|3|4|5;      // Locked|Unlocked|Learning|Practiced|Mastered|Legendary
  accEwma: number;         // recall-level accuracy EWMA
  placedAt?: number;       // epoch day if unlocked via placement/jump (provisional)
  legendaryAt?: number;
}

// ---- per course (one struct) ----
interface CourseEngineState {
  courseId: string;        // "journey-es"
  theta: number; thetaK: number; resultCount: number;
  frontier: string[];      // current teachable skill ids (derived, cached)
  latencyBaselines: Record<ActivityType, {logMean: number; n: number}>;
  flow: { window: FlowSample[]; mode: "cruise"|"normal"|"struggle" };  // session-scoped
  placement?: PlacementRecord;   // §4; kept for audit/UI
  newPerDay: number;       // adaptive new-item throttle (default 12, range 4..30)
}

// ---- review log (ring buffer, for future on-device FSRS optimization) ----
interface ReviewLog { itemId: string; ts: number; grade: 1|2|3|4;
  elapsedDays: number; activityType: string; latencyMs: number; }
// keep last ~20k rows (~1–2 MB) in IndexedDB; prune FIFO.
```

### 3.3 The activity→engine result envelope

This is the seam `pack-contract.md` §3 identifies as missing (`hostApi.journey.reportResult` + `corpan:activity-result` dual-rail). The engine consumes:

```ts
interface ActivityResult {
  activityId: string;            // feed card instance
  activityType: string;          // "listen-pick" | "type-translate" | "speak" | "lingo-hero-round" | ...
  itemRefs: { itemId: string; weight?: number }[];  // 1..n items exercised (games report many)
  correct: boolean | number;     // boolean, or 0..1 partial score (games, STT)
  firstTry: boolean; hintsUsed: number; retried: boolean;
  latencyMs: number;
  form: 0|1|2;                   // recognition | cued recall | production
  evidence?: object;             // e.g. SttTranscriptionResult passthrough
  selfReport?: "already-knew" | "never-learned";
}
```

Multi-item results (a lingo-hero round touches 15 phrases) apply the grade mapping per item with `correct` derived from per-item hit data if the pack supplies it, else the round score applied uniformly at reduced weight (a game round counts as at most GOOD, never EASY, and a bad round degrades to HARD not AGAIN unless per-item misses are known — games are noisy evidence).

### 3.4 Update pipeline (single entry point)

```
onActivityResult(r: ActivityResult):
  for ref in r.itemRefs:
    card  = getOrCreateCard(ref.itemId)
    grade = toGrade(r, card, profile)                 # §1.4
    card  = fsrs.next(card, now, grade)               # ts-fsrs; same-day path if due today
    appendReviewLog(...)
    if grade == AGAIN: sessionReplayQueue.push(ref.itemId, minGap=3)   # §5.4
    if card.lapses >= 6 and card.reps/card.lapses < 2: card.flags |= LEECH  # §6.4
  for skill in skillsOf(r.itemRefs):
    if r.form >= 1: skill.accEwma = 0.7*skill.accEwma + 0.3*score(r)
    maybeLevelChange(skill)                           # §6.2
  theta += thetaK * (score(r) − sigmoid(theta − b(r)))  ; decay thetaK
  flow.window.push({score, latencyZ}) ; flow.mode = classifyFlow(window)  # §6.1
```

---

## 4. Placement

### 4.1 Requirements & prior art

Place a non-zero beginner in **≤ ~5 minutes / ≤ 25 items**, erring slightly low (starting a bit easy is cheap; starting too hard churns). Duolingo's placement is a short CAT: after each answer the ability estimate updates and the next item is drawn from a difficulty-matched set with a random component ([overview](https://englishproficiency.com/duolingo/exam-format/computer-adaptive-testing/); their DET white paper and [BanditCAT/AutoIRT](https://arxiv.org/pdf/2410.21033) describe the industrial-strength version). We need the 80% version: our `b` values are author-assigned, not calibrated, so precision beyond ±half a CEFR band is fake anyway — and §4.4's provisional-placement + first-week correction absorbs the error.

### 4.2 Item bank

The course pack marks, per skill, 2–4 **probe items** (high-frequency, unambiguous, auto-scoreable) with the skill's difficulty `b_s`. Probe activities are fast forms only (listen-pick, translate-pick, tap-order, type-short) — no speaking during placement (mic friction), no hints, no "peek".

### 4.3 Algorithm

```
placeLearner(course):
  # learner chose "I know some <target>" (else skip: theta=-4, frontier=root skills)
  theta = -1.0 ; se = 2.0 ; asked = [] ; K = 0.9

  # Phase 1 — coarse band ladder (≤5 items): one probe per band A1→C1,
  # jump 2 bands up while correct, stop at first miss.
  for b in [-3, -1.5, 0, +1.5, +3]:
    r = ask(probeAt(b)); update(theta, se, r)
    if !r.correct: break

  # Phase 2 — refinement (Elo/1PL online update, max ~14 items)
  while se > 0.45 and count < 20 and elapsed < 4min:
    b_next = theta + N(0, 0.3)          # max-info ≈ b=theta; noise avoids determinism
    item   = sampleUnasked(bank, b_next, spreadSkills=true)
    r = ask(item)
    P = sigmoid(theta - item.b)
    theta += K * (score(r) - P) ; K = max(0.15, K*0.82)
    se = 1 / sqrt(sum of P_i*(1-P_i) over asked)      # Fisher-info approx
    update per-skill probe tallies

  # Phase 3 — frontier confirmation (2-4 items)
  # verify the proposed start skill: 2 probes AT the frontier; both correct → keep;
  # any miss → step frontier back one DAG layer and re-verify once.

  return finalize(theta)
```

`finalize`:

1. **Frontier**: unlock every skill with `b_s ≤ theta − 0.5` (margin errs low) whose DAG prerequisites are also unlocked; the frontier = the first *locked* teachable layer.
2. **Skill levels**: skipped skills get `level = 3 (Practiced)` with `placedAt = today` — *provisional*, not Mastered; they still feed review (below) and can demote (§6.2).
3. **Item seeding — lazy, not eager.** Do **not** create 8k ItemCards at placement. Skipped-skill items get cards **on first natural encounter** (as a review injection or as collateral in an activity): created with a `priorKnown` first review = EASY (S₀ = w3 ≈ 8.3d, then immediately advanced once with GOOD to spread due dates), flags `placementSeeded|priorKnown`. The mixer additionally *samples* skipped-skill items into the review stream at a trickle (§5.3) so the backlog surfaces gradually instead of day-1 avalanche. If a placementSeeded item fails its first encounter, it re-enters as effectively new and its skill's accEwma takes the hit — this is the self-correction channel.
4. Store `PlacementRecord {theta, se, asked[], date}` for audit and for the "was placement wrong?" week-one check: if global accuracy over the first 150 results is <60%, offer a soft rewind (frontier back one layer); if >92% with cruise mode dominant, surface a Jump checkpoint (§6.3).

Zero-beginner path: one screen ("New to Spanish?") — no test, θ=−4, start at skill 1. Placement must never be a wall.

---

## 5. The feed: `nextFeedItems(n=10)`

### 5.1 Inputs

`ItemCards` (due set), `SkillStates` + course DAG (frontier), `CourseEngineState` (θ, flow mode, newPerDay throttle), session context (cards done today, replay queue), strand accounting (Nation's Four Strands tally over the last ~40 cards), installed-experience registry (which activity providers are available — feed must degrade gracefully if e.g. lingo-hero pack isn't installed).

### 5.2 Pool construction

```
DUE      = cards with due <= today, sorted by priority =
             (1 - R(now))            # most-forgotten first
           * itemImportance          # frequency-rank weight from pack (1.0..2.0)
           * (1 + 0.1*lapses)        # struggling items float up
REPLAY   = session replay queue (failed this session, minGap satisfied)   # hard priority
NEW      = next items of frontier skills in pack-authored intro order,
           capped by newPerDayRemaining and gated by flow mode
REPAIR   = items of any skill whose accEwma < 0.6 or that demoted recently
TRICKLE  = unvisited placementSeeded-skill items (placement backlog), tiny rate
FUN      = fluency-strand cards: game rounds, story/reader chapters, beatlounge,
           etymology gems — parameterized over already-strong items (R > 0.9)
```

### 5.3 Mixer (slot-template sampler with interleaving constraints)

Review-injection policy: reviews are **woven, not batched** — interleaved retrieval beats blocked review for retention ([interleaved spaced-repetition evidence](https://callej.org/index.php/journal/article/view/87); Duolingo similarly hides review inside lessons rather than shipping a "review day"). Target review share of the feed ~35% normally, rising automatically when DUE is deep, and review cards are *disguised* as ordinary varied activities — the learner never sees a "review" label.

```
nextFeedItems(n=10):
  slots = []
  quota = { review: 0.35, new: 0.35, repair: 0.10, fun: 0.10, flex: 0.10 }

  # flow-mode adjustments (§6.1)
  if flow == "cruise":   quota.new += quota.repair; quota.repair = 0
                         maybe append JumpCheckpointCard (once per session max)
  if flow == "struggle": quota.new = max(0.1, quota.new - 0.2)
                         quota.review += 0.1; quota.repair += 0.1
                         prepend a scaffold card (re-teach: example + recognition form)

  # backlog pressure: if |DUE| > 2 days of normal throughput, shift flex+0.15 to review
  # strand balancing: if language-focused share over last 40 cards > 65%,
  #   force >=2 FUN/input slots (reader segment, listen-only card)

  for k in 1..n:
    pool = weightedPick(quota, availability)
    if REPLAY nonempty and gapSatisfied: pool = REPLAY      # replays preempt
    item = pop(pool)
    form = chooseForm(item)          # §6.1: recognition < cuedRecall < production,
                                     # ratchet up as card.form and R allow
    type = chooseActivityType(item, form, constraints)
    slots.push(makeCard(item, type, form))

  enforce constraints on slots (swap within window):
    - no two consecutive cards of same activityType
    - >=3 cards between two appearances of the same itemId
    - a NEW item appears >=2 times in its debut session (intro form, then recall form)
    - session opener is always a warm review the learner will likely get right
      (R in 0.8..0.95) — cheap win, primes flow
    - at most 1 FUN full-game card per 10 (games are minutes, not seconds)
  return slots
```

New-item introduction pattern (inside NEW pool): each new item debuts as an **intro card** (show + hear + echo; no scoring), then a recognition card later the same session, then a recall card next day (its first real FSRS review). Intro cards are unscored presentations; the FSRS card is created at the first *scored* exposure.

### 5.4 Same-session replay

Failed items go to REPLAY with `minGap = 3` cards, replayed at an easier or equal form. FSRS-6's short-term parameters (w17–w19) natively model this same-day review (guaranteeing S′ ≥ S on pass) so the long-term schedule stays honest — this is the reason we require `enable_short_term` and FSRS-6, not FSRS-4.5. One replay per failure; a second same-session failure marks the card for tomorrow and stops hammering (frustration guard).

### 5.5 `newPerDay` auto-throttle

`newPerDay` (default 12) adapts weekly: if the DUE backlog median over 7 days exceeds 1.5 sessions' throughput, decrement ×0.8; if backlog ≈ 0 and cruise-share > 50%, increment ×1.2 (bounds 4..30). This is the single most effective burnout knob in SRS systems and must be automatic.

---

## 6. Dynamic difficulty, level-up, skip-ahead

### 6.1 Flow controller (session-scoped)

Windowed signal over the last 8 scored cards: `perf = mean(score) − 0.15·mean(latencyZ>1)`.

- **cruise**: perf ≥ 0.9 and no fails in window → raise form ratchet (prefer production forms), raise distractor difficulty (`b_distractor ≈ θ`), increase NEW quota, surface Jump checkpoint if sustained 2 sessions. Goldilocks logic à la Birdbrain: pick work where predicted P(correct) ≈ 0.8–0.9, not 1.0 ([IEEE Spectrum on Birdbrain](https://spectrum.ieee.org/duolingo)).
- **normal**: defaults.
- **struggle**: ≥3 fails in window or perf < 0.55 → drop form one level (production→cued recall→recognition), inject a scaffold/re-teach card, cut NEW intake, *never* punish visibly — copy stays warm, and the next card after a scaffold is a near-certain win (R>0.9 review) to restore momentum. This is the "gentle reverse": we reverse *exercise form* and *intake rate*, never position on the path.

Form ratchet per item: `card.form` records the highest form passed; `chooseForm` proposes `min(card.form + 1, allowedByR)` where production requires R ≥ 0.7 history. Level-up credit (below) only counts form ≥ 1 (cued recall) — recognition-only grinding can't master a skill (guess-rate control, §1.4).

### 6.2 Skill level-up / demotion criteria

| Level | Enter when | Notes |
|---|---|---|
| 1 Unlocked | All DAG prerequisites ≥ 3 (Practiced) | |
| 2 Learning | First item card created | |
| 3 Practiced | coverage ≥ 0.8 ∧ strength ≥ 0.7 ∧ accEwma ≥ 0.75 | unlocks dependents |
| 4 Mastered | coverage ≥ 0.95 ∧ strength ≥ 0.9 ∧ accEwma ≥ 0.85 ∧ every item form ≥ 1 | |
| 5 Legendary | Pass a dedicated challenge session: 12–16 items of the skill, production-form bias, **no hints, ≤2 mistakes**, one attempt per day | Duolingo Legendary analog ([mechanics](https://duoplanet.com/duolingo-levels/)); purely optional prestige, variable-reward card in the feed |
| demotion | strength < 0.5 (decay) or accEwma < 0.5 → drop to 2, enters REPAIR pool | placement-provisional skills demote the same way — this is how wrong placement self-heals |

Levels are *derived + hysteresis* (recompute on read, but only announce transitions once/day) so the UI never flaps.

### 6.3 Jump-ahead checkpoints (fast-forward)

Modeled on Duolingo's "Jump here" test-out: covers the skipped material, no hints/peeking, limited mistakes, more slack for near jumps than far jumps ([Duolingo wiki: Jump here?](https://duolingo.fandom.com/wiki/Jump_here%3F), [Test-out](https://duolingo.fandom.com/wiki/Test-out)).

```
jumpCheckpoint(targetSkill):                 # offered on sustained cruise, or user-invoked
  skipped = skills on DAG paths frontier→targetSkill
  test    = 3 probes per skipped skill layer, adaptive: start at theta,
            production-form bias, no hints, mistakesAllowed = 3 (near) | 2 (far)
  if pass: for s in skipped: s.level = 3, placedAt = today   # provisional, like placement
           theta += 0.3 ; trickle-seed items (priorKnown, §4.3.3)
  if fail: no penalty; failed layers' items pre-seed as NEW soon ("you're close" framing)
```

### 6.4 Leeches

`lapses ≥ 6` with poor reps/lapse ratio → LEECH flag: the mixer stops normal scheduling and instead (a) swaps presentation (different activity types, add mnemonic/etymology card from wordpan if available), (b) after 2 more failures, suspends the item and substitutes a same-skill alternate (course packs should mark substitutable items). Leeches must not be allowed to eat the feed.

---

## 7. Integration notes & module boundary

- **Engine is a pure TS module** (`journey-engine`): `(state, courseGraph, now) → feed`, `(state, result) → state`. No React, no IO; the zustand/IndexedDB layer wraps it. This makes it property-testable (simulate 10k synthetic learners on the Spark to tune quotas before shipping — free, offline, and exactly the kind of validation `feedback_reproduce_before_shipping_fix` demands).
- **ts-fsrs is the only dependency**; wrap it behind our own `Scheduler` interface so FSRS-7 or a WASM optimizer swap is invisible to the app.
- Needs from other workstreams: static `b` difficulty + probe flags + intro order + item importance in the course-pack schema; the `ActivityResult` dual-rail seam (`hostApi.journey.reportResult` + `corpan:activity-result`, per `pack-contract.md` §3); per-item hit reporting from game packs (lingo-hero et al.) even if approximate.
- **Determinism**: all sampling PRNG-seeded from (profileId, courseId, sessionCounter) — reproducible feeds for debugging.
- **Clock safety**: day-granular `due` uses local epoch-day; guard against device clock jumps (never negative elapsed; cap elapsedDays at 365 for the update).

## 8. Open questions / risks

1. **Static difficulty calibration** — author-assigned `b` will be noisy; placement's Phase-3 confirmation + provisional levels absorb most of it, but we should log (anonymously, opt-in-only, or purely locally) predicted-vs-actual to sanity check pack authoring. Local-only calibration report is enough.
2. **Multi-skill items double-count**: an item in 2 skills updates both accEwmas — acceptable, but coverage math needs the item counted per skill (spec'd) and pack authoring should keep overlap modest.
3. **Game evidence quality**: until packs report per-item hits, game rounds are low-weight evidence; quantify how low via simulation.
4. **Desired-retention as pace knob**: exposing it (even indirectly as "chill/intense") changes review load dramatically; defer until post-launch telemetry-free tuning via simulation.
5. **On-device optimizer**: fsrs-browser (WASM) feasibility in the Tauri WebView on low-end Android is unverified; batch job, so worst case runs only on-charge/idle.
6. **Where placement UX meets zero-decision principle**: placement is the one moment Journey asks questions; keep it under 3 screens of framing.

## Sources

- FSRS-6 formulas & weights: [Expertium — A technical explanation of FSRS](https://expertium.github.io/Algorithm.html); [rs-fsrs algorithm overview (DeepWiki)](https://deepwiki.com/open-spaced-repetition/rs-fsrs/3.1-fsrs-algorithm-overview); [fsrs4anki tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md); [srs-benchmark](https://github.com/open-spaced-repetition/srs-benchmark)
- ts-fsrs: [npm](https://www.npmjs.com/package/ts-fsrs), [repo](https://github.com/open-spaced-repetition/ts-fsrs), [releases](https://github.com/open-spaced-repetition/ts-fsrs/releases) (5.4.1, 2026-05-22)
- Binary grading guidance: [Anki forums — Pass/Fail with FSRS](https://forums.ankiweb.net/t/pass-fail-only-ease-reset-to-250-daily-fsrs-not-for-me-right/37993)
- Birdbrain / IRT-logistic: [IEEE Spectrum — How Duolingo's AI Learns What You Need to Learn](https://spectrum.ieee.org/duolingo); [Duolingo blog — Introducing Birdbrain](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/)
- CAT/placement: [DET CAT overview](https://englishproficiency.com/duolingo/exam-format/computer-adaptive-testing/); [BanditCAT & AutoIRT (arXiv 2410.21033)](https://arxiv.org/pdf/2410.21033); [Duolingo — partial credit placement](https://blog.duolingo.com/partial-credit-improvements-to-duolingos-placement-test/); [CAT item selection components (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5968224/)
- Skip-ahead/Legendary: [Duolingo wiki — Jump here?](https://duolingo.fandom.com/wiki/Jump_here%3F), [Test-out](https://duolingo.fandom.com/wiki/Test-out), [duoplanet — Duolingo levels](https://duoplanet.com/duolingo-levels/)
- BKT vs DKT: [pyBKT (arXiv 2105.00385)](https://arxiv.org/pdf/2105.00385); [Going Deeper with DKT (EDM 2016)](https://www.educationaldatamining.org/EDM2016/proceedings/paper_133.pdf); [BKT overview (EmergentMind)](https://www.emergentmind.com/topics/bayesian-knowledge-tracing-bkt)
- Interleaving: [Interleaved Spaced Repetition & vocabulary (CALL-EJ)](https://callej.org/index.php/journal/article/view/87); [MIT Open Learning — spaced & interleaved practice](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/spaced-and-interleaved-practice)
