# Journey Engagement & Product Mechanics — Research + Design

**Role:** engagement/product-mechanics lead · **Date:** 2026-07-03 · **Branch:** `journey`
**Input to:** chief architect, Phase 2 design synthesis (`corpan/docs/journey/NORTH_STAR.md`)

---

## Part 1 — Research: why Duolingo, TikTok, and great games are compulsive

### 1.1 Duolingo's growth-team learnings (the CURR playbook)

Source: Jorge Mazal (ex-CPO) via [Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth), plus [Trophy's 2026 case study](https://trophy.so/blog/duolingo-gamification-case-study) and [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth).

**The single most important strategic finding: retain the already-retained.** Duolingo bucketed users MECE (new / current / reactivated / resurrected / at-risk WAU / at-risk MAU / dormant) and ran sensitivity analysis: improving **CURR (current-user retention rate) had ~5× the DAU impact** of the next-best lever. A 21% CURR improvement over 4 years cut daily churn of best users >40% and drove 4.5× DAU. **Implication for Journey: the feed must be optimized first for the person who came back today, not for reactivation gimmicks.**

**Mechanics scoreboard (their measured results):**

| Mechanic | Result |
|---|---|
| Leaderboards/leagues | +17% total learning time; 3× "highly engaged" learners; material D1/D7 gains |
| Streaks | Users at 10-day streaks show sharply reduced dropout; 7+ day-streak users ~3×'d to >50% of DAU |
| Streak freeze | −21% churn among at-risk-of-break users (flexibility *increases* persistence) |
| Streak widget (iOS) | ~60% commitment lift claimed ([Trophy](https://trophy.so/blog/duolingo-gamification-case-study)) |
| Push-notification bandit optimization | years of compounding small DAU wins without raising volume ("protect the channel") |
| Gardenscapes-style "moves counter" (lives/energy on lessons) | **completely neutral** — 2 months wasted; tension mechanics from match-3 don't transfer to knowledge tasks |
| Referral program (Uber-style) | +3% only — failed because best users were already subscribed |

**Adaptation framework** (why did it work there → will it transfer → what must change). The moves-counter failure is the cautionary tale: **don't import artificial scarcity/tension into a knowledge product.** This directly validates NORTH_STAR principle 9 (no pay-to-un-lose).

**The 2022 Path redesign** ([Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/), [duoplanet review](https://duoplanet.com/duolingo-new-learning-path-review/)): replaced the branching skill tree with one linear path. Rationale: (a) eliminate decision friction; (b) interleave skills + spaced repetition *inside* the sequence instead of asking users to "go back"; (c) practice framed as forward progress; (d) descriptive unit labels ("get directions"). Beginners' completion rates and reading/listening outcomes improved; power users complained about lost freedom. **Journey's feed is the logical conclusion of this trajectory: path → feed. Duolingo removed "which skill?"; we also remove "tap next lesson."** Their lesson about power users applies: give advanced learners levers (fast-forward, topic bias) without reintroducing choice into the default loop.

### 1.2 TikTok: the doom-scroll pattern decomposed

Sources: [Brainforge on TikTok ML](https://www.brainforge.ai/blog/how-tiktok-uses-machine-learning-to-keep-you-scrolling), [infinite-scroll psychology](https://medium.com/digital-gems/tiktok-and-the-psychology-of-infinite-scroll-d292fd96ef86), [arXiv 2501.11814 on scrolling interventions](https://arxiv.org/pdf/2501.11814).

The compulsion loop has five separable components — Journey can adopt four and deliberately reject one:

1. **Zero decision cost.** The algorithm chooses; the user only swipes. Choice overload is the disease NORTH_STAR names; this is the cure. **Adopt.**
2. **One gesture, one item, full screen.** Interaction cost collapses to a single thumb flick; full-screen framing = total attention on one thing. **Adopt.**
3. **Variable-ratio reward (Skinner).** Unpredictable payoff quality; dopamine spikes on *anticipation*, not delivery. Persistence is strongest when reward is intermittent. **Adopt — but the "jackpot" must be a genuinely better learning artifact (rare card), never a bypass of learning.**
4. **Immediate next-item preload.** The next video is already buffered; there is never a loading gap where reflection could intervene. **Adopt** (prefetch/prerender next card; trivial offline since all content is local).
5. **No natural stopping points** — the attention-capturing dark pattern researchers flag most. **Reject in its pure form.** Journey inserts *earned* stopping points (checkpoint/summit cards) that celebrate and make stopping feel like a win, while still offering "keep going." Compulsion toward mastery means the session should end feeling *complete*, not interrupted.

Also load-bearing: TikTok's per-swipe implicit signal (watch time, replay, skip velocity) feeds ranking. Journey's equivalent is richer: correctness, response latency, hesitation, retry count, skip — feeding the adaptive engine per card. Every scroll is a placement test in disguise.

### 1.3 Game feel: juice

Sources: [Juicy Game Design (CHI PLAY)](https://dl.acm.org/doi/10.1145/3311350.3347171), [GameAnalytics "Squeezing more juice"](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design), [brad woods' juice notes](https://garden.bradwoods.io/notes/design/juice).

- Juice = exaggerated multi-channel feedback (animation, particles, audio, haptics, screen shake, persistence) that makes actions feel significant.
- **Empirical dose-response: medium/high juiciness beats both none and *extreme*** on player experience, intrinsic motivation, play time, and performance. Over-juicing measurably hurts. Budget the celebration to the size of the achievement.
- Persistence matters: effects that leave a visible trace (progress trail growing, constellation star igniting) outperform ephemeral flash.
- Corpan already has framer-motion in the stack (`corpan/corpan-app` deps) and a proven juice vocabulary in lingo-hero; the feed needs a shared celebration system so every provider gets juice for free (see §2.2).

### 1.4 Streak economics in detail

Sources: [Deconstructor of Fun streak teardown](https://duolingo.deconstructoroffun.com/mechanics/streaks), [EngageFabric build guide](https://engagefabric.com/blog/building-duolingo-style-streak-system), [Yu-kai Chou's 4 streak rules](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/), [Apptitude teardown](https://apptitude.io/blog/how-duolingos-streak-mechanic-actually-works/).

- Streaks run on **loss aversion**: users protect the streak more than they extend it, and the pressure compounds with length (goal-gradient + endowment).
- **Flexibility is what makes streaks retain rather than churn**: freeze (up to 2 equipped, bought with soft currency) cut at-risk churn 21%; streak repair windows (3 days, complete lessons to restore, ≥30-day streaks only, no stacking) exist because *a user who loses a 200-day streak may never come back*.
- The dignity failure mode is equally documented: streak anxiety, compulsive checking, coercive notifications put Duolingo on deceptive.design ([UX Collective critique](https://uxdesign.cc/the-good-the-bad-and-the-ugly-of-duolingo-gamification-3a12f0e80dc7)). The mechanic works; the *nagging monetized* version is what people resent.
- Key design split: **streak = showed up** (binary, cheap to satisfy) vs **progress = learned** (XP/mastery). Duolingo keeps these separate; conflating them makes bad days punish learning.

### 1.5 Other established mechanisms worth naming (from the literature)

- **Variable-ratio reinforcement** (Ferster & Skinner): most extinction-resistant schedule; the basis for rare cards.
- **Endowed progress** (Nunes & Drèze): people complete goals faster when given artificial head-starts — "unit 3/12, you already know 8 words here from cognates" beats "unit 0."
- **Goal gradient**: effort accelerates near goal completion — visible "2 cards to checkpoint" is free motivation.
- **Zeigarnik effect**: open loops nag at memory — "next: the mystery of Spanish ser vs estar" teased at session end drives return.
- **Self-Determination Theory** (autonomy/competence/relatedness): intrinsic motivation needs all three; a prescriptive feed risks autonomy, so preserve it via opt-outs, pace levers, and honest framing rather than choice overload.
- **Flow**: challenge must track skill; the adaptive engine is itself an engagement mechanic — flow is what makes 20 minutes feel like 5.
- **Fresh-start effect**: Mondays, month starts, new year = natural comeback hooks (all computable offline from the device clock).

---

## Part 2 — Journey's engagement system (concrete design)

### 2.0 What already exists in the codebase (build on, don't duplicate)

- **Streak accounting**: `corpan/corpan-app/src/store/progress.ts` (137 lines) — `streakDays()` at lines 92–118 computes consecutive-day streak from `lastOpenedAt` local dates, with the humane detail (line ~100) that a streak isn't "lost" before the user opens the app on a new day. localStorage-only, fed by the `corpan:segment-progress` window event.
- **Dignified streak UI**: `corpan/corpan-app/src/components/StreakChip.tsx` — opt-in (off by default, `corpan-streak-enabled` localStorage key), silent, renders nothing at streak 0. Plus `StreakBadge.tsx`, `StreakToggle.tsx`.
- **User intent profile**: `corpan/corpan-app/src/store/settings.ts` lines 235–237 — `userClass`, `ageBand`, `goalIntensity` captured at onboarding. **`goalIntensity` should parameterize session shapes and streak-minimums (see §2.4).**
- **Repo-level design intent** (from `corpan/CLAUDE.md`): streak is "opt-in/dignified", no Duolingo dark patterns, no absolutes in copy. Journey's system must upgrade engagement power *within* that stance.

### 2.1 The scroll-feed interaction model

**Card lifecycle (the core loop, ~15–90 s per card):**

1. **Arrive** — card is full-screen, already rendered (next card always pre-mounted below the fold; content is local so prefetch is free). A one-line "why this card" affordance available on long-press ("reviewing *pedir* — last seen 4 days ago") for transparency, never forced into view.
2. **Do** — one activity, one interaction paradigm per card (tap, speak, type, order, listen, play). The activity contract's completion callback returns `{outcome, score, latency, hintsUsed}`.
3. **Celebrate** — host-owned celebration layer (see §2.2), scaled to outcome. Duration 400–1200 ms, skippable by scroll.
4. **Advance** — two modes, user-settable, default **scroll-to-advance**: the completed card visibly "settles" (checkmark stamp, slight shrink) and the next card peeks ~15% from the bottom, inviting the swipe. The swipe *is* the commitment gesture — it preserves a sliver of agency (SDT autonomy) and gives the thumb a ritual. **Auto-advance** (800 ms after celebration) available in settings for listen-heavy/hands-busy sessions.
5. **Scroll-back is read-only review** (like TikTok): you can swipe up to re-see the last N completed cards (their answers shown), but not re-earn. Kills grinding, keeps the "wait, what was that word?" affordance.

**Failure handling:** wrong answer never blocks scrolling for long. One retry inline with a scaffold (reveal one word, slow the audio); second miss → show answer, brief "we'll come back to this" note, card re-enqueued by the engine 3–8 cards later in an easier form. No lives, no lesson restart (the Gardenscapes lesson: tension mechanics are neutral-at-best here).

**Feed composition is the engine's job, but engagement constrains the mixer:**
- **Pacing rhythm**: no more than 2 consecutive cards of the same activity type; a "heavy" card (speaking, writing) is followed by a "light" card (pick, listen). This is the interleaving that makes 15 minutes feel short.
- **Difficulty saw-tooth**: aim ~80–85% success rate overall (flow band), but deliberately plant one "easy win" card after any 2-miss stretch.
- **Rare-card injection** on a variable-ratio schedule (§2.3).
- **Checkpoint card** roughly every 8–12 cards (§2.4).

**Zero decision cost, preserved levers:** the only persistent chrome is a thin progress ribbon (top) and the streak chip (if opted in). Levers for power users — "bias toward speaking," "skip ahead," "review only" — live behind a single unobtrusive menu, never as feed interruptions. This is how we serve Duolingo's alienated power users without reintroducing choice overload.

### 2.2 Juice: the shared celebration system

Build **one** host-owned `CelebrationLayer` so every activity provider (lingo-hero round, phrase card, reader chapter) gets consistent, tuned feedback without implementing its own:

- **Tier 0 — correct**: soft chime + checkmark morph + subtle card glow. (~400 ms)
- **Tier 1 — perfect / fast / combo (5-in-a-row)**: particle burst in the target language's course color, haptic tick, combo counter that grows visibly. Duolingo's 5-streak lightning moment is the model.
- **Tier 2 — milestone**: word #500 learned, unit summit, streak day 7/30/100 — full-screen moment with the progress visualization animating (constellation star igniting, §2.5), stat card generated ("you can now understand 71% of spoken Spanish word tokens" — computable offline from frequency data).
- **Tier 3 — rare card reveal**: distinct "shimmer" pre-animation *before* the card flips over, so the anticipation moment (where dopamine actually lives) is designed, not accidental.
- **Dose control**: global juice intensity setting (full / reduced / minimal) — the research says extreme juice backfires, and `ageBand`/`userClass` should set smart defaults (kids: fuller; "serious adult learner": restrained by default).
- Sounds are a tuned family (pentatonic ascending per combo — beatlounge assets are candidate fuel), never speech-overlapping.

### 2.3 Variable-reward economy: rare cards, not loot boxes

The "reward" in a learning feed must be *better content*, so the compulsion and the mastery are the same axis. Rarity tiers on a variable-ratio schedule (engine-seeded, deterministic offline):

- **Common (~1 in 8–12 cards): delight variants** — a phrase delivered by a different narrator voice, an image card (direct-method picture, NORTH_STAR §8), a "did you notice?" micro-pattern callout.
- **Uncommon (~1 in 20–30): mini-game round** — one round of lingo-hero / juice-squeeze / hover-runner *using the learner's current live vocabulary*. This is the modular-contract payoff: existing experiences become slot-machine jackpots. Game rounds are short (≤90 s) and their score feeds the engine like any card.
- **Rare (~1 in 40–60): etymology gem** (wordpan corpus: 11,757 words × 54 langs — a beautiful typographic card on a word the learner *just* learned), **culture/insight card**, or a **"time capsule"** (re-show a card they struggled with 3 weeks ago, now trivially easy — competence made visible; this is the cheapest wow we own).
- **Epic (session/summit-gated): story chapter** — a narrated book segment (earthgate/stargate reader packs) unlocks when the learner's vocabulary covers ~95% of its tokens. Framed as "you've earned the next chapter," it is simultaneously reward, comprehensible input, and Zeigarnik hook (chapters end teased).

**Rules:** rarity is never purchasable, never skippable-content-in-disguise, and rare cards still count as learning (they carry recall or exposure value). The schedule is variable-*ratio* around fixed means, jittered per-user-seed, so no two sessions rhyme.

**Currency: recommend NO soft currency (gems) at P0.** Gems exist in Duolingo to create a sink economy for freezes/outfits and monetization pressure — our repair mechanics are earned by learning, not bought (§2.6), and cosmetic sinks can come later (P2: constellation themes, narrator voice unlocks) if wanted. XP exists but is honest: **XP = weighted learning events** (new item first-recall > review > exposure), used for daily-goal fill and the personal-records system, not for competitive comparison.

### 2.4 Session shapes: 30 seconds to 20 minutes, all first-class

The feed is continuous, but sessions need *shape* — a beginning, earned peaks, and a dignified end. `goalIntensity` (already captured at onboarding, `store/settings.ts:237`) selects the default daily target; all shapes valid any day:

- **Micro (30–90 s, 1–3 cards):** one review card + streak tick. The first card of any session is always a *warm* card (high-confidence review) — instant win in <15 s. A micro session fully counts for the streak (streak = showed up).
- **Standard (3–7 min, ~10–20 cards):** one full "arc": warm-up → 1–2 new items → interleaved review → checkpoint card. **Checkpoint cards** every 8–12 cards are the designed stopping points: they summarize ("3 new words, 9 reviews, best combo 7"), animate the progress viz, tick the daily ring, then offer *equal-weight* "Done for now" and "Keep going." Stopping at a checkpoint is presented as a win, not an interruption — this is our principled deviation from TikTok.
- **Deep (10–20+ min):** multiple arcs; the mixer raises rare-card frequency slightly in later arcs (variable reward sustains long sessions), inserts a story chapter or game round as a mid-session peak, and gently increases review share late (fatigue-appropriate).
- **End-of-session Zeigarnik tease:** the next session's headline card is named but not shown ("Next: how Mandarin says yesterday/tomorrow with up and down"). One line, no pressure.

Daily goal = a simple ring (cards or minutes, by intensity). Overfilling shows as "over-glow," never a second guilt ring.

### 2.5 Progress visualization: the constellation

**Recommendation: a constellation per target language** (over map/path metaphors):

- Each **star = a concept cluster** (unit); stars ignite at first completion, brighten with mastery, and **dim slowly toward "needs review"** — decay made visible without red-alarm guilt. Constellations (CEFR-ish bands / thematic regions) connect ignited stars with drawn lines: A1 near the horizon, rare literary grammar in the far field. The sky's depth *is* the zero-to-fluency promise.
- Why constellation > path: (a) a path implies a single finish line — a 54-course product wants an *expanding sky*; (b) multiple target languages = multiple skies from one "observatory," making multi-language learners visible to themselves; (c) decay/renewal (FSRS reality) maps naturally to brightness, whereas a path can't un-walk itself gracefully; (d) it's distinctive — every competitor has a path/map.
- The feed still *feels* linear (a thin "next stars on your route" ribbon shows the local path through the sky); the constellation is the zoom-out view, entered from checkpoints and milestones — where Tier-2 celebrations play out (a star visibly ignites while you watch).
- **Endowed progress at placement:** placement lights the stars you already know ("you're starting with 214 stars lit — cognates are on your side"), never an empty sky for a non-beginner.
- Offline share artifact: a rendered PNG of your sky ("Skyler's Spanish sky — 214 stars, day 41") — social proof without a network.

### 2.6 Streak design: dignified but real

Keep the existing opt-in stance but make the streak *worth* opting into, and consider default-on-with-taste for Journey users (decision for architect: the current chip is off by default; Journey's pact-style onboarding — `OnboardingWelcomePact.tsx` exists — could offer the streak as part of an explicit commitment ritual, which is consent, not a dark pattern):

- **Streak = "showed up"**: any card completed today ticks it. Never require a quota for the tick (quota lives in the daily ring instead).
- **Rest days, not "freezes" you buy:** earn **1 rest-day token per 7 consecutive days** (cap 2 banked, matching Duolingo's proven cap) — auto-applied on a missed day, shown honestly ("Tuesday was a rest day"). Nothing is purchased; the economy is time-in, not money-in. This keeps the −21%-churn flexibility benefit without the gem shop.
- **Repair by learning:** a broken streak ≥14 days offers a 3-day window to restore via a "comeback set" (2 standard sessions). Repair is always learning-priced, never gem-priced. No stacking; one repair banked at a time.
- **Milestone moments, not daily nags:** day 7/30/100/365 get Tier-2 celebrations and a permanent constellation artifact (a named star). No push notifications about streaks at all at P0 (we have no notification infra dependence and the channel-poisoning risk is documented); the OS widget (P1) showing sky + streak is the passive reminder — the mechanic behind Duolingo's ~60% widget commitment lift, minus the desperation-owl tone.
- **Copy discipline:** "41 days" — never "don't lose your streak!", never absolutes ("never miss again"). The streak states a fact; the user supplies the meaning.

### 2.7 Comeback & lapse mechanics (all offline, clock-driven)

- **Lapse detection is local:** days-since-last-open computed on launch (`progress.ts` already stores `lastOpenedAt`).
- **Welcome-back, zero shame:** after 7+ days away, the first session is a **re-entry arc**: 3–5 warm high-confidence cards (guaranteed wins), then a soft re-calibration card disguised as play ("quick sky-check"), then the engine quietly reschedules decayed items. Copy: "Your sky kept 89% of its light." Never "you lost X" — frame retention, not loss.
- **Fresh-start hooks:** on Mondays/month-starts after a lapse, the checkpoint card offers "start a fresh chapter" framing (fresh-start effect, computable from the device calendar).
- **Decay is honest but gentle:** stars dim; they never turn red or vanish. A dimmed star tapped from the sky enqueues its review into the next session — the *one* place user-directed choice enters the feed, and it's a pull, not a push.
- **Long-dormant (30+ days):** offer "resize my journey" — one tap to re-place (short placement arc) rather than face a mountain of overdue reviews. FSRS backlogs are the classic silent killer of returning spaced-rep users; cap visible review debt always ("today: 12 reviews," never "347 overdue").

### 2.8 Social feel without a server (offline-compatible relatedness)

No live leagues. Alternatives that create relatedness/comparison pressure entirely on-device:

1. **Ghost of you (P0):** personal records as the opponent — best combo, best week, fastest recall, deepest session. Checkpoint cards surface record proximity ("2 cards from your best Tuesday"). Racing your own ghost is proven in racing games and is honest.
2. **Percentile phantoms (P1):** ship static, pack-versioned distribution curves (computed on the Spark from anonymized/simulated cohort data or synthetic priors) — "your recall speed on this unit is faster than ~70% of learners at this level." Honest copy: "compared with typical learners" (no live claim). Careful: this must be clearly framed to avoid implying live comparison.
3. **Narrator/tutor persona (P1):** the course has a voice — narration voices and the on-device Qwen3 tutor (tutomaton) give a *character* who notices ("you've gotten fast at past tense"). Parasocial presence is Duolingo's owl minus the threats; tone: warm coach, never guilt-tripper. All LLM lines template-constrained (no absolutes, no invented facts — cf. no-fictional-narrator-details rule).
4. **Shareable artifacts (P1):** rendered sky PNG, milestone cards — the user carries social proof to their own channels; the app needs no network.
5. **Same-device duel (P2):** pass-the-phone quiz round from current vocabulary — household multiplayer, fully offline.
6. **Sky exchange (P2/parked):** import a friend's exported sky file to see their constellation beside yours. Zero servers; explicit file exchange.

### 2.9 Ethical design: compulsion toward mastery, not dark patterns

Principles (aligned with `corpan/CLAUDE.md` "no Duolingo dark patterns" and the no-absolutes rule; informed by [deceptive.design's Duolingo entries](https://uxdesign.cc/the-good-the-bad-and-the-ugly-of-duolingo-gamification-3a12f0e80dc7) and [attention-capture dark-pattern research](https://arxiv.org/pdf/2501.11814)):

1. **The reward is the learning.** Every variable-reward artifact (game round, gem, chapter) has real pedagogical value. If a "reward" teaches nothing, it doesn't ship.
2. **Designed stopping points.** Checkpoints celebrate stopping as success. We adopt TikTok's frictionless *next*, we reject its endlessness-by-omission. "Done for now" is always one tap, visually equal to "Keep going."
3. **No purchased absolution.** Rest days and repairs are earned by time and learning, never bought. No energy, no lives, no moves counters (empirically neutral anyway).
4. **Loss framed as fact, not threat.** Streak copy states; it never menaces. No late-night "Duo is sad" notifications. Widget shows state, not desperation.
5. **Consent rituals over defaults-abuse.** Streak and notifications are part of an explicit onboarding pact the user speaks to, with real off switches that stay off.
6. **No absolutes in copy** (banned: "never lose your progress," "always free," "100% mastery"). Softened, truthful claims only — house rule, enforced in string review.
7. **Transparency affordance:** long-press any card → why it was chosen. The algorithm is inspectable, which converts "it's manipulating me" into "it's coaching me."
8. **Time dignity:** if a session passes ~25 minutes, the next checkpoint says so plainly ("that's a deep session — your reviews are scheduled for tomorrow either way"). We *report* time, we don't cut anyone off, and we never optimize for time-on-app as a KPI — our north-star metric should be **CURR × learning-events per returning day**, not minutes.
9. **Kids' defaults** (`ageBand`): fuller juice, but comparison mechanics (percentile phantoms) off by default.

### 2.10 Instrumentation the mechanics need (on-device only)

Per-card event log (local, feeding both the adaptive engine and the mechanics): `{cardId, activityType, outcome, score, latencyMs, hintsUsed, sessionId, ts}` plus derived: session length distribution, checkpoint stop-vs-continue rate, rare-card anticipation completion, streak survival curves, comeback conversion. Extend `store/progress.ts` (currently 137 lines, open-count + streak only) into a proper local event store — this is the substrate for every mechanic above and for offline A/B-style self-tuning later.

---

## Part 3 — Prioritized mechanics list

### P0 — the compulsion core (ship with first course pack)
1. **Full-screen card feed** with scroll-to-advance, pre-mounted next card, read-only scroll-back, inline retry-with-scaffold (no lives).
2. **Shared CelebrationLayer** (Tier 0–2 juice, combo counter, intensity setting).
3. **Checkpoint cards** every 8–12 cards: summary, daily ring, equal-weight stop/continue.
4. **Session shapes**: warm first card <15 s; micro/standard/deep arcs parameterized by existing `goalIntensity`.
5. **Streak v2** on existing `progress.ts`/`StreakChip`: showed-up semantics, earned rest days (1/7, cap 2), learning-priced repair, milestone celebrations; onboarding pact consent.
6. **Variable-ratio rare-card injection** with the two cheapest tiers: delight variants + etymology gems (wordpan corpus) + time-capsule cards.
7. **Constellation progress view v1** (ignite/brighten/dim; placement lights known stars; checkpoint zoom-out animation).
8. **Local event store** (per-card outcomes) powering all of the above.
9. **Welcome-back re-entry arc** + visible-review-debt cap.

### P1 — the retention amplifiers
1. **Mini-game rounds as uncommon rare cards** (first 2–3 providers: lingo-hero, juice-squeeze) via the activity contract.
2. **Story chapters as epic rewards** (reader packs, 95%-coverage unlock, chapter-end Zeigarnik tease).
3. **OS home-screen widget**: sky thumbnail + streak (the passive-reminder mechanic, dignified tone).
4. **Ghost-of-you personal records** surfaced at checkpoints; session-end stat cards.
5. **Narrator/tutor persona lines** (template-constrained Qwen3/tutomaton observations at checkpoints).
6. **Shareable sky/milestone PNG export.**
7. **Percentile phantoms** (static shipped distributions, carefully framed).
8. **Fresh-start comeback framing**; dormant "resize my journey" re-placement.
9. **End-of-session next-card tease** (Zeigarnik).

### P2 — the delight & depth layer
1. Cosmetic economy (constellation themes, star colors, narrator voice unlocks) — earned, never bought with money.
2. Same-device pass-the-phone duel.
3. Sky-exchange file import (offline friend comparison).
4. Seasonal/calendar event cards (device-clock-driven, no server).
5. Adaptive juice tuning per user (celebration intensity self-calibrates to response).
6. Offline self-tuning of mixer parameters from the local event store (per-user bandit over card-mix ratios).

---

## Gaps & open questions (honest)

1. **Rare-card ratios (1:8/1:25/1:50) are educated guesses** — no public data exists for learning feeds; needs on-device tuning hooks from day one (P2.6) and dogfood calibration.
2. **Percentile phantoms need a data source** — synthetic priors vs early telemetry-with-consent is an unresolved product/ethics call.
3. **Default-on vs opt-in streak for Journey** conflicts mildly with the current app-wide opt-in stance (`StreakChip.tsx` header comment) — architect decision; the pact-consent pattern is my recommended resolution.
4. **Auto-advance vs scroll-to-advance default** deserves a real usability test; I recommend scroll-to-advance on theory (commitment gesture, autonomy) but TikTok's autoplay success argues the other way for listen-heavy cards.
5. **Constellation rendering cost** on low-end Android under Tauri/webview is unvalidated (hundreds of animated stars → likely needs canvas/WebGL, not DOM).
6. **Notification strategy is deliberately deferred** — Duolingo's biggest single channel is the one most likely to violate our tone; widget-first is the bet, but it means forgoing a proven DAU lever.
7. **CURR-style bucket accounting** (current/at-risk/resurrected) should be computed locally for adaptive comeback behavior — not yet specced anywhere.
8. Sources on specific Duolingo numbers (widget +60%, freeze −21%) are **secondary/case-study sites**, not primary Duolingo publications — treat as directional, not gospel.

## Sources

- [How Duolingo reignited user growth — Jorge Mazal / Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- [The science behind Duolingo's home screen redesign — Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/)
- [Duolingo gamification case study 2026 — Trophy](https://trophy.so/blog/duolingo-gamification-case-study)
- [Duolingo streak teardown — Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks)
- [Duolingo: gaming principles for DAU growth — Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)
- [Building a Duolingo-style streak system — EngageFabric](https://engagefabric.com/blog/building-duolingo-style-streak-system)
- [Streak design rules — Yu-kai Chou](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/)
- [How Duolingo's streak mechanic actually works — Apptitude](https://apptitude.io/blog/how-duolingos-streak-mechanic-actually-works/)
- [How TikTok uses ML to keep you scrolling — Brainforge](https://www.brainforge.ai/blog/how-tiktok-uses-machine-learning-to-keep-you-scrolling)
- [TikTok and the psychology of infinite scroll — Digital GEMs](https://medium.com/digital-gems/tiktok-and-the-psychology-of-infinite-scroll-d292fd96ef86)
- [Contextual influences on interventions during infinite scrolling — arXiv 2501.11814](https://arxiv.org/pdf/2501.11814)
- [Juicy Game Design — CHI PLAY proceedings](https://dl.acm.org/doi/10.1145/3311350.3347171)
- [Squeezing more juice out of your game design — GameAnalytics](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design)
- [Juice — brad woods design garden](https://garden.bradwoods.io/notes/design/juice)
- [The good, the bad and the ugly of Duolingo gamification — UX Collective](https://uxdesign.cc/the-good-the-bad-and-the-ugly-of-duolingo-gamification-3a12f0e80dc7)
- [Duolingo learning path review — duoplanet](https://duoplanet.com/duolingo-new-learning-path-review/)
- [Juicy or dry? Engagement and retention in interactive infographics — arXiv 2506.17011](https://arxiv.org/pdf/2506.17011)
