# Learning integration contract

Import the public surface from `./learning`. All persisted types are JSON-safe.
No learner names, credentials or provider keys enter the prompt context.

```ts
const learner = createLearner(localProfileId, 4);
const { system, context, candidates } = buildTutorContext(learner);
// Send these through the real Free2Z adapter. No provider JSON mode is assumed.
const result = validateActivity(modelText, candidates.map(c => c.skill.id));
if (result.ok) {
  const activity = result.activity;
  // Render activity.prompt and activity.visual; never the raw model question.
  const feedback = gradeAnswer(activity, learnerAnswer);
  if (!feedback.error) {
    const next = recordAttempt(learner, activity, {
      id: stableSubmissionId, answer: learnerAnswer,
      hintsUsed: hintsOpened, activeMs: visibleForegroundMs,
      interrupted: taskWasBackgrounded,
    });
    // Persist next and its evidence atomically before selecting another activity.
  }
}
```

The module is pure apart from optional default clock values. Supply explicit times
and seeds for tests. Errors in numeric entry are input errors, not wrong answers.
A submitted activity and attempt ID are idempotent; a second try needs a newly
identified activity and cannot rewrite the first answer. The one exception is the
forgiving retry: after a first miss the controller saves the miss (as assistance)
in the presentation session, shows a nudge without the result, and allows one more
answer. The ledger still holds one attempt per activity, recorded with
`firstAnswer` (the gradable miss). `recordAttempt` rejects a correct `firstAnswer`
and treats any attempt carrying one as assisted, so a correct retry never counts as
independent evidence. Restores replay `firstAnswer` and reject records that drop it. `generatePractice()`
creates a validated local task for an assessed skill; it throws for guided-only
skills. Always label local practice honestly, particularly after network failure.

`validateActivity()` accepts a parsed object or bounded JSON string and reconstructs
all canonical quantities, question text, task fingerprint and visual. It discards
model-proposed prompts, visuals and answer keys. Optional explanations and hints
are unverified teaching text: sanitize rendering, label AI content, permit dispute,
and do not use them as grading authority. No arbitrary expressions, JavaScript,
external assets or visual programs execute. Choices have distinct exact values
and exactly one computed correct answer. Timed fluency cannot use answer choices.

Supported exact task families: arithmetic, comparison, missing operand, fraction
picture, place value, rounding, arithmetic sequence, rectangle/triangle/prism
measurement, linear equation, integer power, GCF/LCM, mean/median/range, elementary
probability, percentage, unit rate, slope, integer Pythagorean lengths and bounded
polynomial evaluation. Fractions and finite decimals normalize using BigInt.
Input is bounded to 18 digits; validation rejects any task whose answer cannot be
entered within that grammar. Skill-specific guards constrain operations and topic.
A small numeric answer does not prove the broader conceptual requirement.

Progress policy is intentionally transparent and provisional:

- Three distinct independently correct tasks since the last assisted/wrong answer
  establish provisional numerical understanding. Slow correct answers still count.
- Fluency requires the last twelve recall-mode attempts since assistance or error,
  independently correct, without answer choices or interrupted timing, within the
  skill's target, across at least eight distinct tasks and two UTC dates. The
  thresholds are product defaults, not validated population norms or diagnoses.
- Reviews use 1/3/7/14/30-day spacing. Same-day wins do not confirm retention.
  Two successful due reviews establish retained numerical evidence; later failure
  clears retention and starts a next-day review. The longest interval repeats.
- `selectCandidates()` supplies due/support/continuation/frontier/placement choices.
- After errors (`struggleFocus()`, selection policy only): one miss gets a fresh
  retry of the same skill, never an immediate step down. A second miss offers a
  `worked-example` approach: the controller shows a solved task of the same skill
  with a different result and quantities (`workedExampleHint()`, so a reordered
  or inverted fact cannot give the answer away) and records that attempt as
  assisted. A skill is never shown more than three times in a row while missing,
  or four when the last was an assisted success (one independent try after a
  worked example): the learner then gets a `confidence` item from demonstrated
  work, else one confirmed step down, else a nearby easier topic, then returns.
  Outside placement a step down is one direct prerequisite; during the twelve
  placement attempts it halves the grade gap between the missed skill and the
  highest demonstrated prerequisite (or K), and probes back up after a success.
  A prerequisite that is itself confirmed difficult is not offered as easier.
  A hinted correct answer no longer adds prerequisite support to the menu; only
  confirmed misses do. `recentStreak(attempts, skillId)` exposes the trailing
  misses/successes signal.
  Already demonstrated prerequisites are not automatically re-taught after a slip.
  Conceptual advancement does not wait for multi-day fluency.
- `selectFluencySkill(learner, now?)` chooses among all provisionally learned fact
  skills still developing fluency, regardless of the latest question's topic. It
  prefers fewer timed attempts today, then least recent recall practice, and stops
  after six timed attempts per skill per UTC date. The controller interleaves these
  short checks without displacing immediate support or due reviews. This limit does
  not award fluency: the existing twelve fast independent answers, eight variants,
  and two-date evidence requirements still apply.
- `generateFreshPractice(skillId, learner, seed?, mode?)` avoids the previous twelve
  variants for that skill using a bounded search. For small exhausted fact sets it
  prefers the least recent candidate. The controller still assigns a new activity ID.
- Local generated tasks include concise hints and exact task-derived explanations
  from `teachTask()`, including fraction arithmetic, regrouping, geometry and algebra.
  Revealing teaching remains assisted practice; it does not award independent credit.
  The first twelve attempts favor breadth across domains. Starting grade is only a
  placement hint; existing success does not permanently fence the learner in.
- `quarantineActivity()` marks disputed evidence and rebuilds projections from the
  remaining history. It preserves original attempts for audit and removes disputed
  evidence from prompt context. Persist that update in the same transaction as the
  dispute. `rebuildProgress()` is available for recovery/migrations.

`ActiveTimer` accepts monotonic timestamps from the UI. Pause on app background,
window blur, hidden document or task departure; resume on actual visible activity.
An interruption disqualifies the time from fluency evidence, not the conceptual
answer. Do not infer elapsed time from request duration, wall-clock timestamps,
or provider latency. Cached/locally generated review tasks avoid network timing.

Run from `aha/aha-app`: `node --import tsx --test src/learning/learning.test.ts`.
Tests include the full generator matrix, independently enumerated expected answers,
fractions/decimals, malformed model output, false topic credit, duplicates, varied
success, delayed reviews, assisted answers, choice/recall separation, disputes and
foreground timing. The module requires ES2022 or newer and no runtime dependencies.
